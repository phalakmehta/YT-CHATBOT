import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# This looks for the .env file and loads the variables
load_dotenv()

# Now you can access it safely
groq_key = os.getenv("GROQ_API_KEY")



from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_groq import ChatGroq
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda
from langchain_core.output_parsers import StrOutputParser

app = Flask(__name__)
CORS(app)

# ── shared state ────────────────────────────────────────────────
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

llm = ChatGroq(model="openai/gpt-oss-120b", temperature=0.2)

prompt = PromptTemplate(
    template="""
      You are a helpful assistant.
      Answer ONLY from the provided transcript context.
      If the context is insufficient, just say you don't know.

      {context}
      Question: {question}
    """,
    input_variables=["context", "question"],
)

# video_id -> chain
chains = {}

# ── helpers ─────────────────────────────────────────────────────
def extract_video_id(url: str) -> str:
    import re
    patterns = [
        r"(?:v=)([A-Za-z0-9_-]{11})",
        r"(?:youtu\.be/)([A-Za-z0-9_-]{11})",
        r"(?:embed/)([A-Za-z0-9_-]{11})",
        r"(?:shorts/)([A-Za-z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    # treat raw 11-char string as ID
    if re.match(r"^[A-Za-z0-9_-]{11}$", url):
        return url
    raise ValueError("Could not extract video ID from URL")


def build_chain(video_id: str):
    # ── STEP 1: INDEXING (same as notebook) ──
    ytt_api = YouTubeTranscriptApi()
    transcript_list = ytt_api.fetch(video_id, languages=["en"])
    transcript = " ".join(chunk.text for chunk in transcript_list)

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.create_documents([transcript])

    vector_store = FAISS.from_documents(chunks, embeddings)

    # ── STEP 2: RETRIEVAL ──
    retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": 4})

    # ── STEP 3 & 4: AUGMENTATION + GENERATION (chain) ──
    def format_docs(retrieved_docs):
        return "\n\n".join(doc.page_content for doc in retrieved_docs)

    parallel_chain = RunnableParallel({
        "context": retriever | RunnableLambda(format_docs),
        "question": RunnablePassthrough(),
    })

    parser = StrOutputParser()
    main_chain = parallel_chain | prompt | llm | parser
    return main_chain, transcript[:200]  # return preview too


# ── routes ───────────────────────────────────────────────────────
@app.route("/load", methods=["POST"])
def load_video():
    data = request.get_json()
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    try:
        video_id = extract_video_id(url)
        if video_id not in chains:
            chain, preview = build_chain(video_id)
            chains[video_id] = chain
        return jsonify({"video_id": video_id, "status": "ready"})
    except TranscriptsDisabled:
        return jsonify({"error": "No captions available for this video."}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    video_id = data.get("video_id", "").strip()
    question = data.get("question", "").strip()
    if not video_id or not question:
        return jsonify({"error": "Missing video_id or question"}), 400
    if video_id not in chains:
        return jsonify({"error": "Video not loaded. Call /load first."}), 400
    try:
        answer = chains[video_id].invoke(question)
        return jsonify({"answer": answer})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=False)
