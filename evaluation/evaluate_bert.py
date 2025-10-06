from bert_score import score
import json
import csv
from datetime import datetime

# Fungsi klasifikasi F1
def classify_f1(f1):
    if f1 >= 0.85:
        return "Good"
    elif f1 >= 0.65:
        return "Medium"
    else:
        return "Bad"

# Baca file JSON
with open("question_JSON.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Ambil data prediksi & ground truth
predictions = [item["prediction"] for item in data]
references = [item["groundTruth"] for item in data]

# Hitung skor BERT
P, R, F1 = score(predictions, references, lang="id", verbose=True)

# Buat timestamp untuk nama file
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

# Hitung rata-rata dan label
precision_avg = P.mean().item()
recall_avg = R.mean().item()
f1_avg = F1.mean().item()
labels = [classify_f1(f.item()) for f in F1]
label_counts = {
    "Good": labels.count("Good"),
    "Medium": labels.count("Medium"),
    "Bad": labels.count("Bad")
}


json_output = {
    "metadata": {
        "evaluation_date": datetime.now().isoformat(),
        "total_questions": len(data),
        "label_counts": label_counts
    },
    "overall_scores": {
        "precision": precision_avg,
        "recall": recall_avg,
        "f1": f1_avg
    },
    "detailed_results": [
        {
            "question_id": idx + 1,
            **item,
            "scores": {
                "precision": p.item(),
                "recall": r.item(),
                "f1": f.item(),
                "label": classify_f1(f.item())
            }
        }
        for idx, (item, p, r, f) in enumerate(zip(data, P, R, F1))
    ]
}






with open(f"evaluation_results_{timestamp}.json", "w", encoding="utf-8") as f:
    json.dump(json_output, f, indent=2, ensure_ascii=False)

# Simpan hasil ke CSV
with open(f"evaluation_results_{timestamp}.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["ID", "Question", "Ground Truth", "Prediction", "Precision", "Recall", "F1", "Label"])

    for i, (q, p, r, f1, label) in enumerate(zip(data, P, R, F1, labels)):
        writer.writerow([
            i + 1, q["question"], q["groundTruth"], q["prediction"],
            f"{p:.4f}", f"{r:.4f}", f"{f1:.4f}", label
        ])

    writer.writerow([])  # baris kosong
    writer.writerow(["RATA-RATA", "", "", "",
                     f"{precision_avg:.4f}",
                     f"{recall_avg:.4f}",
                     f"{f1_avg:.4f}", ""])
    writer.writerow(["JUMLAH", "", "", "",
                     f"Good: {label_counts['Good']}",
                     f"Medium: {label_counts['Medium']}",
                     f"Bad: {label_counts['Bad']}", ""])

print(f"""
✅ Evaluasi selesai!
📁 JSON disimpan di: evaluation_results_{timestamp}.json
📊 CSV disimpan di:  evaluation_results_{timestamp}.csv
""")
