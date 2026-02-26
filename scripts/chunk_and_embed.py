import os
import json
import uuid
import time
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv(dotenv_path='.env.local')

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
embedding_model = "models/gemini-embedding-001"

def chunk_markdown(text, source, max_chars=1200, overlap=200):
    chunks = []
    lines = text.split('\n')
    current_chunk = ""
    
    for line in lines:
        if len(current_chunk) + len(line) > max_chars:
            if current_chunk:
                chunks.append({
                    "id": f"{source}-{uuid.uuid4().hex[:8]}",
                    "content": current_chunk.strip(),
                    "source": source
                })
                # Preserve overlap
                current_chunk = current_chunk[-overlap:] + "\n" + line + "\n"
            else:
                # Line itself is too long
                current_chunk = line + "\n"
        else:
            current_chunk += line + "\n"
    
    if current_chunk:
        chunks.append({
            "id": f"{source}-{uuid.uuid4().hex[:8]}",
            "content": current_chunk.strip(),
            "source": source
        })
    
    return chunks

def generate_embeddings(chunks):
    print(f"Generating embeddings for {len(chunks)} chunks...")
    batch_size = 100
    processed_chunks = []
    
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i+batch_size]
        contents = [c["content"] for c in batch]
        
        try:
            result = genai.embed_content(
                model=embedding_model,
                content=contents,
                task_type="retrieval_document"
            )
            
            for j, emb in enumerate(result['embedding']):
                processed_chunks.append({
                    **batch[j],
                    "embedding": emb
                })
            print(f"Processed {len(processed_chunks)}/{len(chunks)}")
            time.sleep(0.5) # Rate limit safety
        except Exception as e:
            print(f"Error in batch {i}: {e}")
            # Fallback: add without embedding if needed, or retry
            for c in batch:
                processed_chunks.append(c)
                
    return processed_chunks

def main():
    files = [
        {"path": "GDPR.md", "label": "GDPR"},
        {"path": "PDPA_2025.md", "label": "PDPA 2025"},
        {"path": "PDPA_SL.md", "label": "PDPA SL"}
    ]
    
    all_chunks = []
    for file_info in files:
        if not os.path.exists(file_info["path"]):
            print(f"File not found: {file_info['path']}")
            continue
            
        print(f"Processing {file_info['label']}...")
        with open(file_info["path"], "r", encoding="utf-8") as f:
            text = f.read()
            
        chunks = chunk_markdown(text, file_info["label"])
        print(f"Extracted {len(chunks)} chunks from {file_info['label']}")
        all_chunks.extend(chunks)
        
    final_data = generate_embeddings(all_chunks)
    
    output_dir = "lib/data"
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "chunks.json")
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_data, f, indent=2)
        
    print(f"Successfully saved {len(final_data)} chunks to {output_file}")

if __name__ == "__main__":
    main()
