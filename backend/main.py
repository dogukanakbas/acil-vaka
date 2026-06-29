from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
import bcrypt
from jose import JWTError, jwt
import os
import uuid
import base64
from typing import Optional, List
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

from sqlalchemy.orm import Session
from database import init_db, get_db
from models import ChatSession, Message, Feedback, ExpertReview, User

from apscheduler.schedulers.background import BackgroundScheduler

app = FastAPI(title="Acil Vaka Asistanı API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Auth Configurations
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "b3c9d7f6e8a10f4c28b51d39e2a7b140")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

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

def cleanup_old_images():
    try:
        db = next(get_db())
        now = datetime.utcnow()
        seven_days_ago = now - timedelta(days=7)
        old_messages = db.query(Message).filter(Message.image_path != None, Message.created_at < seven_days_ago).all()
        for msg in old_messages:
            if msg.image_path and os.path.exists(msg.image_path):
                os.remove(msg.image_path)
            msg.image_path = None
        db.commit()
    except Exception as e:
        print("Cleanup error:", e)

scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_old_images, 'interval', days=1)

CHROMA_PATH = "./chroma_db"
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

db_vector = None
qa_chain = None

@app.on_event("startup")
def on_startup():
    init_db()
    # Auto-migrate schema for image_path
    try:
        from sqlalchemy import text
        from database import SessionLocal
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE messages ADD COLUMN image_path VARCHAR;"))
            db.commit()
        except Exception:
            pass
        finally:
            db.close()
    except Exception:
        pass
    scheduler.start()

def init_qa_chain():
    global db_vector, qa_chain
    if os.path.exists(CHROMA_PATH):
        db_vector = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
        retriever = db_vector.as_retriever(search_kwargs={"k": 3})
        
        llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0.2)
        
        from langchain_core.prompts import ChatPromptTemplate
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Sen kıdemli bir Acil Tıp Uzmanı ve Konsültan Hekimsin. Karşındaki kişi bir hasta değil, acil serviste nöbet tutan ve sana danışan bir hekim/pratisyen hekimdir.
Asla "acile gidin", "doktora görünün" gibi hasta yönlendirmeleri YAPMA!
Sana verilen VAKA BİLGİLERİ (Bağlam) üzerinden doğrudan ayırıcı tanılar, istenmesi gereken tetkikler, acil servis tedavi algoritmaları ve meslektaşına öneriler sun. Asla bağlamdaki metni olduğu gibi kopyalayıp cevap olarak verme, onu analiz et.

TIBBİ BAĞLAM / BİLGİ BANKASI:
{context}"""),
            ("human", "Meslektaşımın Danıştığı Soru/Vaka: {question}")
        ])
        
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
    image_base64: Optional[str] = None
    vision_model: str = "gpt-4o"

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
    
    if not os.path.exists(CHROMA_PATH) and not req.image_base64:
        raise HTTPException(status_code=500, detail="Veritabanı (Vektör DB) henüz hazır değil.")
        
    # Session Management
    session_id = req.session_id
    if not session_id:
        session_id = str(uuid.uuid4())
        new_session = ChatSession(id=session_id, user_id=current_user.id)
        db.add(new_session)
        db.commit()
    else:
        # Check mandatory feedback
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

    image_path = None
    if req.image_base64:
        if req.vision_model == "gpt-4o" and not os.environ.get("OPENAI_API_KEY"):
            raise HTTPException(status_code=500, detail="OpenAI API anahtarı ayarlanmamış.")
        if req.vision_model == "gemini-1.5-pro" and not os.environ.get("GOOGLE_API_KEY"):
            raise HTTPException(status_code=500, detail="Google API anahtarı ayarlanmamış.")
            
        try:
            # Parse and save image
            b64_data = req.image_base64
            if "," in b64_data:
                b64_data = b64_data.split(",")[1]
            image_data = base64.b64decode(b64_data)
            filename = f"{uuid.uuid4()}.jpg"
            filepath = os.path.join("uploads", filename)
            with open(filepath, "wb") as f:
                f.write(image_data)
            image_path = f"/uploads/{filename}"
        except Exception as e:
            raise HTTPException(status_code=400, detail="Geçersiz görsel formatı.")

    # Save User Message
    user_msg = Message(id=str(uuid.uuid4()), session_id=session_id, role="user", content=req.message, image_path=image_path)
    db.add(user_msg)
    db.commit()
        
    try:
        # Generate AI Answer
        if req.image_base64:
            from langchain_core.messages import SystemMessage, HumanMessage
            content = [
                {"type": "text", "text": f"Lütfen bu tıbbi görseli ve klinik bilgiyi değerlendirerek meslektaşına ayırıcı tanılar, ileri tetkikler ve tedavi adımları açısından konsültasyon ver.\n\nHekimin Notu: {req.message}"},
                {"type": "image_url", "image_url": {"url": req.image_base64 if req.image_base64.startswith("data:image") else f"data:image/jpeg;base64,{req.image_base64}"}}
            ]
            
            if req.vision_model == "gpt-4o" and not os.environ.get("OPENAI_API_KEY"):
                raise HTTPException(status_code=500, detail="OpenAI API anahtarı ayarlanmamış.")
            if req.vision_model != "gpt-4o" and not os.environ.get("GOOGLE_API_KEY"):
                raise HTTPException(status_code=500, detail="Google Gemini API anahtarı ayarlanmamış.")
                
            if req.vision_model == "gpt-4o":
                vision_llm = ChatOpenAI(model="gpt-4o", max_tokens=1024)
            else:
                vision_llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro-latest", max_tokens=1024)
                
            messages = [
                SystemMessage(content="Sen kıdemli bir Acil Tıp Uzmanı ve Konsültan Hekimsin. Karşındaki kişi acil serviste nöbet tutan bir hekim meslektaşındır. Asla 'doktora başvurun' veya 'acile gidin' deme, o zaten bir doktor. Doğrudan profesyonel tıbbi konsültasyon ver."),
                HumanMessage(content=content)
            ]
            vision_result = vision_llm.invoke(messages)
            result = vision_result.content
        else:
            if not os.environ.get("GROQ_API_KEY"):
                raise HTTPException(status_code=500, detail="Groq API anahtarı eksik.")
            if qa_chain is None:
                init_qa_chain()
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
        error_msg = str(e)
        if "429" in error_msg or "quota" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Seçtiğiniz yapay zeka modelinin (OpenAI/Gemini) kotası veya bakiyesi yetersiz. Lütfen faturalandırma ayarlarınızı kontrol edin veya diğer modele geçin.")
        elif "404" in error_msg or "not found" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Seçilen yapay zeka modeli bulunamadı veya bu API anahtarı için aktif değil.")
        raise HTTPException(status_code=500, detail=f"Yapay Zeka Hatası: {error_msg}")

# --- KNOWLEDGE BASE (ADMIN) ENDPOINTS ---

DATA_DIR = "./data"

def process_pdf_background(file_path: str):
    try:
        from langchain_community.document_loaders import PyPDFLoader
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        
        loader = PyPDFLoader(file_path)
        documents = loader.load()
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200, length_function=len)
        chunks = text_splitter.split_documents(documents)
        
        global db_vector
        if db_vector is None:
            if os.path.exists(CHROMA_PATH):
                db_vector = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
            else:
                db_vector = Chroma.from_documents(chunks, embeddings, persist_directory=CHROMA_PATH)
                db_vector.persist()
                init_qa_chain()
                return
        
        # OOM veya Chroma limitine takılmamak için batch (parça parça) ekleme yapıyoruz
        batch_size = 5000
        for i in range(0, len(chunks), batch_size):
            db_vector.add_documents(chunks[i:i+batch_size])
            
        db_vector.persist()
        
        # Re-init QA chain to ensure it uses the latest retriever
        init_qa_chain()
        print(f"Background PDF processing completed for: {file_path}")
        
    except Exception as e:
        print(f"Background PDF processing error: {str(e)}")

@app.post("/api/knowledge/upload")
async def upload_knowledge(background_tasks: BackgroundTasks, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Yetkisiz işlem. Sadece yöneticiler bilgi bankasına veri ekleyebilir.")
        
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        
    file_path = os.path.join(DATA_DIR, file.filename)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    # Process PDF in background so HTTP request doesn't timeout for large books
    if file.filename.endswith(".pdf"):
        background_tasks.add_task(process_pdf_background, file_path)
            
    return {"message": f"{file.filename} başarıyla sunucuya yüklendi. Arka planda okuma/öğrenme işlemi devam ediyor. (Kitap boyutuna göre birkaç dakika sürebilir)."}

@app.get("/api/knowledge/files")
def list_knowledge_files(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Yetkisiz işlem.")
        
    if not os.path.exists(DATA_DIR):
        return []
        
    files = []
    for f in os.listdir(DATA_DIR):
        if f.endswith(".pdf") or f.endswith(".txt"):
            path = os.path.join(DATA_DIR, f)
            size_mb = os.path.getsize(path) / (1024 * 1024)
            files.append({
                "filename": f,
                "size": f"{size_mb:.2f} MB"
            })
    return files

@app.delete("/api/knowledge/files/{filename}")
def delete_knowledge_file(filename: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Yetkisiz işlem.")
        
    file_path = os.path.join(DATA_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"message": "Dosya başarıyla silindi."}
    else:
        raise HTTPException(status_code=404, detail="Dosya bulunamadı.")

@app.get("/api/chat/sessions")
def get_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).all()
    result = []
    for s in sessions:
        first_msg = db.query(Message).filter(Message.session_id == s.id, Message.role == "user").order_by(Message.created_at.asc()).first()
        title = "Yeni Sohbet"
        if first_msg:
            title = first_msg.content[:35] + "..." if first_msg.content else "Görsel Vaka"
        result.append({
            "id": s.id,
            "title": title,
            "created_at": s.created_at
        })
    return result

@app.get("/api/chat/sessions/{session_id}")
def get_session_messages(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı.")
    
    messages = db.query(Message).filter(Message.session_id == session_id).order_by(Message.created_at.asc()).all()
    
    result = []
    for m in messages:
        fb = None
        if m.feedback:
            fb = "positive" if m.feedback.is_positive else "negative"
        result.append({
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "image_url": f"http://147.93.57.202:8000{m.image_path}" if m.image_path else None,
            "feedback": fb
        })
    return result

@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(Message).filter(Message.id == req.message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı.")
        
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
        msg = r.message
        context_msgs = db.query(Message).filter(
            Message.session_id == msg.session_id,
            Message.created_at <= msg.created_at
        ).order_by(Message.created_at.asc()).all()
        
        history = [{"role": m.role, "content": m.content, "image_url": f"http://147.93.57.202:8000{m.image_path}" if m.image_path else None} for m in context_msgs]
        
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
