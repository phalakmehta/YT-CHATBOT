**YT Chatbot**

*RAG-Powered YouTube Chrome Extension*

![](media/9036d2fa379c6cc38125912a4f2666e5f059ac68.png){width="5.416666666666667in" height="3.2291666666666665in"}

*Extension in action --- chatting with a 3Blue1Brown neural network video*

What It Does

YT Chatbot is a Chrome extension that lets you chat with any YouTube video. Paste a YouTube URL, wait a few seconds for the video to be indexed, and then ask anything --- the chatbot answers using only what was said in the video.

It is powered by a local Flask backend that runs the same RAG (Retrieval-Augmented Generation) pipeline built in the original Jupyter notebook --- no logic was changed.

Tech Stack

|                   |                                                                            |
|-------------------|----------------------------------------------------------------------------|
| **Component**     | **Detail**                                                                 |
| **LLM**           | Groq --- openai/gpt-oss-120b (temperature 0.2)                             |
| **Embeddings**    | HuggingFace --- sentence-transformers/all-MiniLM-L6-v2                     |
| **Vector Store**  | FAISS (in-memory, per session)                                             |
| **Text Splitter** | RecursiveCharacterTextSplitter --- chunk: 1000, overlap: 200               |
| **Transcript**    | YouTube Transcript API                                                     |
| **Backend**       | Flask (Python) running on localhost:5000                                   |
| **Frontend**      | Chrome Extension --- popup.html + popup.js                                 |
| **Chain**         | LangChain --- RunnableParallel \| PromptTemplate \| LLM \| StrOutputParser |

How the RAG Pipeline Works

RAG stands for Retrieval-Augmented Generation. Instead of asking the LLM from memory, we first retrieve the relevant parts of the transcript and feed them as context. This means answers are grounded in what the video actually says.

Step 1 --- Indexing

When you click Load, the backend:

1.  Extracts the video ID from the URL

2.  Fetches the full transcript using YouTubeTranscriptApi

3.  Splits the transcript into overlapping chunks (1000 chars, 200 overlap) using RecursiveCharacterTextSplitter

4.  Embeds each chunk using HuggingFace all-MiniLM-L6-v2 and stores them in a FAISS vector index

Step 2 --- Retrieval

When you ask a question, the backend embeds your query using the same model and performs a similarity search on the FAISS index to find the top 4 most relevant transcript chunks.

Step 3 --- Augmentation

The retrieved chunks are injected into a prompt template alongside your question. The prompt instructs the LLM to answer only from the provided transcript context, not from general knowledge.

Step 4 --- Generation

The final prompt is sent to Groq (LLM). The response is streamed back through the LangChain chain, parsed by StrOutputParser, and returned as JSON to the extension popup.

The LangChain Chain

RunnableParallel( context: retriever \| format_docs, question: passthrough )

\| PromptTemplate( context + question )

\| ChatGroq( openai/gpt-oss-120b )

\| StrOutputParser()

How to Set It Up

Part 1 --- Start the Backend (every time you use it)

Open a terminal in the backend/ folder and run:

pip install -r requirements.txt

python app.py

*Keep this terminal open. The server runs on http://127.0.0.1:5000 --- opening that in a browser will show 404, which is normal. It is an API server, not a website.*

Part 2 --- Load the Extension into Chrome (one-time only)

5.  Open Chrome and go to chrome://extensions

6.  Turn on Developer mode (toggle in the top-right corner)

7.  Click Load unpacked

8.  Select the extension/ folder from the project

9.  The YT Chatbot icon appears in the Chrome toolbar

Part 3 --- Using the Extension

10. Make sure the backend terminal is running (Part 1)

11. Go to any YouTube video

12. Click the extension icon --- the URL auto-fills

13. Click Load and wait 15--30 seconds for indexing

14. When the green dot appears, start chatting!

Important Notes

- The backend must be running every time you use the extension

- The extension folder stays loaded in Chrome permanently --- no need to reload it

- Each video is indexed once per session; reloading the same video is instant

- The popup closes when you click outside --- this is normal Chrome extension behaviour

- Videos without captions/subtitles enabled will not work

- Press Enter to send a message, Shift+Enter for a new line
