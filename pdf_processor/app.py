
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pathlib import Path
import os

from processor import (
    process_pdf,
    get_all_sessions,
    clear_temp_folder,
    clear_session,
    TEMP_FOLDER
)

app = Flask(__name__)
CORS(app)

MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB max file size
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "service": "pdf-processor"})


@app.route('/api/process-pdf', methods=['POST'])
def process_pdf_endpoint():
    
    if 'file' not in request.files:
        return jsonify({
            "success": False,
            "error": "No file provided"
        }), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({
            "success": False,
            "error": "No file selected"
        }), 400
    
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({
            "success": False,
            "error": "File must be a PDF"
        }), 400
    
    paper_id = request.form.get('paper_id', None)
    
    try:
        pdf_bytes = file.read()
        
        result = process_pdf(pdf_bytes, paper_id)
        
        if result["success"]:
            return jsonify(result), 200
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """Get all processed sessions with their student data."""
    try:
        sessions = get_all_sessions()
        return jsonify({
            "success": True,
            "sessions": sessions
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a specific session."""
    try:
        success = clear_session(session_id)
        return jsonify({
            "success": success
        }), 200 if success else 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/clear-all', methods=['DELETE'])
def clear_all():
    """Clear all processed data."""
    try:
        success = clear_temp_folder()
        return jsonify({
            "success": success
        }), 200 if success else 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/images/<path:filepath>', methods=['GET'])
def serve_image(filepath):
    """Serve processed images from the temp folder."""
    try:
        full_path = (TEMP_FOLDER / filepath).resolve()
        temp_resolved = TEMP_FOLDER.resolve()
        
        if not str(full_path).startswith(str(temp_resolved)):
            print(f"Security blocked: {full_path} not in {temp_resolved}")
            return jsonify({"error": "Invalid path"}), 403
        
        if not full_path.exists():
            print(f"File not found: {full_path}")
            return jsonify({"error": "File not found"}), 404
        
        directory = full_path.parent
        filename = full_path.name
        
        return send_from_directory(directory, filename)
    except Exception as e:
        print(f"Error serving image: {e}")
        return jsonify({"error": str(e)}), 404


@app.route('/api/student-pdf/<session_id>/<cms_id>', methods=['GET'])
def get_student_pdf(session_id, cms_id):
    """Serve the combined PDF for a specific student."""
    try:
        cms_id_safe = cms_id.replace('/', '-')
        
        pdf_path = (TEMP_FOLDER / session_id / cms_id_safe / "answer_sheet.pdf").resolve()
        temp_resolved = TEMP_FOLDER.resolve()
        
        if not str(pdf_path).startswith(str(temp_resolved)):
            return jsonify({"error": "Invalid path"}), 403
        
        if not pdf_path.exists():
            return jsonify({"error": "PDF not found"}), 404
        
        return send_from_directory(pdf_path.parent, pdf_path.name, mimetype='application/pdf')
    except Exception as e:
        print(f"Error serving PDF: {e}")
        return jsonify({"error": str(e)}), 404


if __name__ == '__main__':
    print("=" * 50)
    print("PDF Processing Service")
    print("=" * 50)
    print(f"Temp folder: {TEMP_FOLDER}")
    print("Starting server on port 5001...")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=5001, debug=True)
