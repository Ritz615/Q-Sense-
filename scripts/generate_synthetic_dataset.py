"""
Generates reproducible synthetic queue dataset for Q-Sense.
Usage: python scripts/generate_synthetic_dataset.py
"""
import sys
import os

workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

from ml.data.generator import export_sample_dataset_csv


def main():
    target_csv = os.path.join(workspace_root, "ml", "data", "datasets", "government_office_queue_sample.csv")
    print("Generating 30-day synthetic dataset with diurnal peaks, lunch dips, and counter outages...")
    export_sample_dataset_csv(target_csv, days=30, seed=42)
    print(f"Dataset generated successfully at: {target_csv}")


if __name__ == "__main__":
    main()
