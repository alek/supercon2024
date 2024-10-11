import csv
import json
import argparse
import sys

def csv_to_json(csv_file_path, json_file_path):
    # Open the CSV file
    with open(csv_file_path, mode='r', encoding='utf-8') as csv_file:
        csv_reader = csv.DictReader(csv_file)
        # Convert CSV rows to a list of dictionaries
        rows = list(csv_reader)
    
    # Write the JSON data to a file
    with open(json_file_path, mode='w', encoding='utf-8') as json_file:
        json.dump(rows, json_file, indent=4, ensure_ascii=False)

def main():
    # Set up the argument parser
    parser = argparse.ArgumentParser(
        description='Convert a CSV file to JSON format.',
        usage='python %(prog)s csv_file json_file'
    )
    parser.add_argument('csv_file', help='Path to the input CSV file')
    parser.add_argument('json_file', help='Path to the output JSON file')

    # If no arguments are provided, show the usage message
    if len(sys.argv) == 1:
        parser.print_usage()
        sys.exit(1)

    # Parse the command-line arguments
    args = parser.parse_args()

    # Convert CSV to JSON
    csv_to_json(args.csv_file, args.json_file)

if __name__ == '__main__':
    main()
