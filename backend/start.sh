#!/bin/bash
echo "Installing dependencies..."
pip install -r requirements.txt --break-system-packages -q

echo ""
echo "Starting YT Chatbot backend on http://localhost:5000"
echo ""
python app.py
