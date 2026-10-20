import os, re, joblib
from fastapi import FastAPI
from pydantic import BaseModel
import train as trainer

app = FastAPI(title="Ticket ML Service")
CAT_PATH = os.path.join(trainer.MODEL_DIR, "category.joblib")
PRI_PATH = os.path.join(trainer.MODEL_DIR, "priority.joblib")

if not (os.path.exists(CAT_PATH) and os.path.exists(PRI_PATH)):
    trainer.train()
cat_model = joblib.load(CAT_PATH)
pri_model = joblib.load(PRI_PATH)

NEG = {"angry", "terrible", "awful", "worst", "frustrated", "unacceptable", "useless", "horrible", "ridiculous", "disappointed", "refund", "broken", "scam", "never", "still", "again", "furious", "cancel"}
POS = {"thanks", "thank", "great", "love", "awesome", "appreciate", "excellent", "happy", "perfect", "wonderful"}


def sentiment(text: str) -> float:
    """Tiny lexicon sentiment in [-1, 1]. Swap for a transformer model when you need accuracy."""
    words = re.findall(r"[a-z']+", text.lower())
    if not words:
        return 0.0
    score = sum(w in POS for w in words) - sum(w in NEG for w in words)
    return max(-1.0, min(1.0, score / 3))


class Ticket(BaseModel):
    subject: str = ""
    body: str = ""


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/classify")
def classify(t: Ticket):
    text = f"{t.subject} {t.body}"
    cp = cat_model.predict_proba([text])[0]
    pp = pri_model.predict_proba([text])[0]
    return {
        "category": str(cat_model.classes_[cp.argmax()]),
        "priority": str(pri_model.classes_[pp.argmax()]),
        "confidence": round(float(cp.max()), 3),
        "priorityConfidence": round(float(pp.max()), 3),
        "sentiment": round(sentiment(text), 3),
    }
