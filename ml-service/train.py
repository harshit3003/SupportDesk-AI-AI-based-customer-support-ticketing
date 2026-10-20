"""Train category + priority classifiers.

Uses data/tickets.csv (columns: subject,body,category,priority) if present,
otherwise falls back to a small synthetic dataset so the stack runs out of the box.
Replace with real labelled tickets (e.g. agent-corrected labels exported from the API) for production.
"""
import csv, os, random, joblib
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(HERE, "models")
CSV_PATH = os.path.join(HERE, "data", "tickets.csv")

PHRASES = {
    "billing": ["I was charged twice for my subscription", "Need a refund for last month's invoice", "My credit card was declined but money left my account", "Please update the billing address on my invoice", "Why did my plan price increase", "Coupon code not applied at checkout"],
    "technical": ["The app crashes when I open the dashboard", "I get a 500 error when uploading a file", "Login page keeps loading forever", "API returns timeout errors", "Integration with Slack stopped syncing", "The mobile app freezes after the latest update"],
    "account": ["I forgot my password and the reset email never arrives", "Please delete my account", "How do I change the email on my profile", "Two-factor authentication locked me out", "Add a new team member to my workspace", "My account was suspended without notice"],
    "shipping": ["My order has not arrived yet", "Tracking shows delivered but I have no package", "Wrong item received in my parcel", "Can I change the delivery address", "Package arrived damaged", "Delivery is delayed by two weeks"],
    "feature_request": ["It would be great to have a dark mode", "Can you add export to CSV", "Please support single sign on", "Suggestion: allow bulk editing of items", "Any plans for a mobile widget", "We would love calendar integration"],
    "general": ["What are your support hours", "Do you offer a student discount", "Where can I find your documentation", "I have a question about your company", "Can someone call me about enterprise options", "Thanks for the great service"],
}
URGENT = ["URGENT: production is down", "Critical issue, we are losing customers", "Immediately needed, blocking our whole team", "ASAP this is an emergency"]
HIGH = ["This is really important", "Very frustrated, still not fixed after several days", "Need help today please"]
LOW = ["No rush at all", "Whenever you get a chance", "Just a small thing", "Not urgent"]


def synthetic():
    random.seed(7)
    rows = []
    for cat, phrases in PHRASES.items():
        for p in phrases:
            for _ in range(14):
                r = random.random()
                if r < 0.15: pri, pre = "urgent", random.choice(URGENT)
                elif r < 0.40: pri, pre = "high", random.choice(HIGH)
                elif r < 0.70: pri, pre = "low", random.choice(LOW)
                else: pri, pre = "medium", ""
                if cat in ("feature_request", "general") and pri in ("urgent", "high"):
                    pri = "medium"; pre = ""
                body = f"{pre}. {p}. Please help." if pre else f"{p}. Please help."
                rows.append((p, body, cat, pri))
    return rows


def load_rows():
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, newline="", encoding="utf-8") as f:
            return [(r["subject"], r["body"], r["category"], r["priority"]) for r in csv.DictReader(f)]
    return synthetic()


def make_pipe():
    return Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, lowercase=True)),
        ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
    ])


def train():
    rows = load_rows()
    X = [f"{s} {b}" for s, b, _, _ in rows]
    os.makedirs(MODEL_DIR, exist_ok=True)
    for idx, name in ((2, "category"), (3, "priority")):
        y = [r[idx] for r in rows]
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        pipe = make_pipe().fit(Xtr, ytr)
        print(f"== {name} ==")
        print(classification_report(yte, pipe.predict(Xte), zero_division=0))
        pipe.fit(X, y)  # refit on everything for serving
        joblib.dump(pipe, os.path.join(MODEL_DIR, f"{name}.joblib"))


if __name__ == "__main__":
    train()
