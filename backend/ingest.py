import os
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

DATA_DIR = "./data"
CHROMA_PATH = "./chroma_db"

def ingest_data():
    print(f"Loading PDFs from {DATA_DIR}...")
    loader = PyPDFDirectoryLoader(DATA_DIR)
    documents = loader.load()
    
    if not documents:
        print("No documents found in the data directory.")
        return

    print(f"Loaded {len(documents)} pages. Splitting into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    chunks = text_splitter.split_documents(documents)
    print(f"Split into {len(chunks)} chunks.")

    print("Initializing embedding model (this may take a moment to download)...")
    # Using a fast, lightweight multilingual model or standard English one
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    print("Storing chunks in Chroma database...")
    db = Chroma.from_documents(
        chunks, 
        embeddings, 
        persist_directory=CHROMA_PATH
    )
    db.persist()
    print(f"Data ingestion complete! Database saved to {CHROMA_PATH}")

if __name__ == "__main__":
    # Ensure data directory exists
    if not os.path.exists(DATA_DIR):
        print(f"Error: {DATA_DIR} does not exist.")
    else:
        ingest_data()
