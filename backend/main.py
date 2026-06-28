from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
import uuid
from typing import Optional, List
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

from sqlalchemy.orm import Session
from database import init_db, get_db
from models import ChatSession, Message, Feedback, ExpertReview, User

app = FastAPI(title="Acil Vaka Asistanı API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Configurations
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "b3c9d7f6e8a10f4c28b51d39e2a7b140")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

CHROMA_PATH = "./chroma_db"
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

db_vector = None
qa_chain = None

@app.on_event("startup")
def on_startup():
    init_db()

def init_qa_chain():
    global db_vector, qa_chain
    if os.path.exists(CHROMA_PATH):
        db_vector = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
        retriever = db_vector.as_retriever(search_kwargs={"k": 3})
        
        llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0.2)
        
        template = """Aşağıdaki medikal soruyu veya vakayı bir doktor gibi profesyonelce Türkçe olarak yanıtla. 
Bağlamdaki tıbbi bilgileri kullan. Eğer cevap bağlamda yoksa kendi medikal bilgini kullanarak en iyi öneriyi yap, ancak uydurma yapma.

Bağlam: {context}

Soru: {question}

Yanıt:"""
        prompt = PromptTemplate.from_template(template)
        
        def format_docs(docs):
            return "\n\n".join(doc.page_content for doc in docs)
            
        qa_chain = (
            {"context": retriever | format_docs, "question": RunnablePassthrough()}
            | prompt
            | llm
            | StrOutputParser()
        )

# Auth Endpoints
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "doctor"

@app.post("/api/auth/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı.")
    hashed_password = get_password_hash(user.password)
    new_user = User(email=user.email, password_hash=hashed_password, role=user.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Başarıyla kayıt olundu."}

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hatalı e-posta veya şifre.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Hesabınız henüz yönetici tarafından onaylanmadı.")
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}


# Chat Endpoints
class QueryRequest(BaseModel):
    session_id: Optional[str] = None
    message: str

class FeedbackRequest(BaseModel):
    message_id: str
    is_positive: bool

class ExpertReviewRequest(BaseModel):
    message_id: str
    doctor_note: str

class ExpertAnswerRequest(BaseModel):
    expert_response: str

@app.post("/api/chat")
def chat_endpoint(req: QueryRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    global qa_chain
    
    if not os.path.exists(CHROMA_PATH):
        raise HTTPException(status_code=500, detail="Veritabanı (Vektör DB) henüz hazır değil.")
        
    if not os.environ.get("GROQ_API_KEY"):
        raise HTTPException(status_code=500, detail="Groq API anahtarı eksik.")
        
    if qa_chain is None:
        init_qa_chain()

    # Session Management
    session_id = req.session_id
    if not session_id:
        session_id = str(uuid.uuid4())
        new_session = ChatSession(id=session_id, user_id=current_user.id)
        db.add(new_session)
        db.commit()
    else:
        # Check mandatory feedback (every 5 interactions)
        ai_messages = db.query(Message).filter(
            Message.session_id == session_id,
            Message.role == 'assistant'
        ).all()
        
        if len(ai_messages) > 0 and len(ai_messages) % 5 == 0:
            last_ai_msg = ai_messages[-1]
            if not last_ai_msg.feedback:
                raise HTTPException(
                    status_code=403, 
                    detail="Sistemi kullanmaya devam etmek için lütfen önceki yanıtlara geri bildirim (👍/👎) verin."
                )

    # Save User Message
    user_msg = Message(id=str(uuid.uuid4()), session_id=session_id, role="user", content=req.message)
    db.add(user_msg)
    db.commit()
        
    try:
        # Generate AI Answer
        result = qa_chain.invoke(req.message)
        
        # Save AI Message
        ai_msg_id = str(uuid.uuid4())
        ai_msg = Message(id=ai_msg_id, session_id=session_id, role="assistant", content=result)
        db.add(ai_msg)
        db.commit()
        
        return {
            "session_id": session_id,
            "message_id": ai_msg_id,
            "response": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(Message).filter(Message.id == req.message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı.")
        
    # Verify the message belongs to the current user's session
    session = db.query(ChatSession).filter(ChatSession.id == msg.session_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Erişim reddedildi.")
        
    feedback = db.query(Feedback).filter(Feedback.message_id == req.message_id).first()
    if feedback:
        feedback.is_positive = req.is_positive
    else:
        feedback = Feedback(message_id=req.message_id, is_positive=req.is_positive)
        db.add(feedback)
    
    db.commit()
    return {"status": "success"}

@app.post("/api/expert-review")
def request_expert_review(req: ExpertReviewRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(Message).filter(Message.id == req.message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı.")
        
    review = ExpertReview(message_id=req.message_id, doctor_note=req.doctor_note)
    db.add(review)
    db.commit()
    return {"status": "success"}

@app.get("/api/expert-reviews")
def get_expert_reviews(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "expert":
        raise HTTPException(status_code=403, detail="Bu sayfaya sadece uzman hekimler erişebilir.")
        
    reviews = db.query(ExpertReview).filter(ExpertReview.is_resolved == False).all()
    result = []
    for r in reviews:
        # Include context for the expert
        msg = r.message
        context_msgs = db.query(Message).filter(
            Message.session_id == msg.session_id,
            Message.created_at <= msg.created_at
        ).order_by(Message.created_at.asc()).all()
        
        history = [{"role": m.role, "content": m.content} for m in context_msgs]
        
        result.append({
            "id": r.id,
            "doctor_note": r.doctor_note,
            "created_at": r.created_at,
            "history": history
        })
    return result

@app.post("/api/expert-reviews/{review_id}/answer")
def answer_expert_review(review_id: int, req: ExpertAnswerRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "expert":
        raise HTTPException(status_code=403, detail="Bu işlemi sadece uzman hekimler yapabilir.")
        
    review = db.query(ExpertReview).filter(ExpertReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
        
    review.expert_response = req.expert_response
    review.is_resolved = True
    db.commit()
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
