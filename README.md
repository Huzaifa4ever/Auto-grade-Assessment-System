# Auto Grade System

An automated grading platform for handwritten student answer sheets using OCR, computer vision, and LLM-powered evaluation.

## Features

- **Teacher Authentication** - Signup, Login, Forgot Password (email OTP), Profile Management
- **Multi-Teacher Isolation** - Each teacher sees only their own data (papers, students, evaluations)
- **Question Paper Management** - Upload PDF, parse with LLM (Cerebras), edit questions/parts/sub-parts with marks & rubrics
- **Course Management** - Shared course catalog with department/prefix/level extraction
- **Answer Sheet Generation** - Download student-specific answer sheets with QR codes per question
- **Answer Sheet Processing** - Upload scanned PDFs - image extraction - QR decoding - marker detection - perspective crop
- **Student CSV Upload** - Import student lists for name lookup by CMS ID
- **OCR Pipeline** - Google Colab-based OCR with automatic job queue
- **LLM Evaluation** - Per-question grading via Cerebras LLM with rubric-based assessment
- **Student Reports** - View/edit per-question marks & feedback, re-evaluate, print PDF reports
- **Excel Export** - Export all student results to `.xlsx` with marks, averages, and accuracy metrics
- **Dashboard** - Total evaluated, average OCR accuracy, average LLM confidence

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- PDF.js for PDF text extraction
- xlsx for Excel export
- Custom CSS modules for styling

### Backend
- Node.js with Express
- MongoDB (Mongoose ODM)
- JWT authentication with bcrypt
- Cerebras LLM API for evaluation and paper parsing
- Nodemailer for password reset emails
- CORS enabled

### PDF Processor
- Python 3 with Flask
- OpenCV for image processing (marker detection, perspective transformation)
- pyzbar for QR code decoding
- pdf2image for PDF - image conversion

### OCR
- Google Colab notebook (`ocr_pipeline.ipynb`) using Google Vision API
- Communicates with the backend via ngrok tunnel

## Prerequisites

- **Node.js** (v18+) - [Download](https://nodejs.org/)
- **Python** (3.10+) - [Download](https://python.org/)
- **MongoDB Atlas** account or local MongoDB (v6+)
- **Git** - [Download](https://git-scm.com/)
- **Poppler** - Required by pdf2image (`sudo apt install poppler-utils`)
- **zbar** - Required by pyzbar (`sudo apt install libzbar0`)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Auto-Grade-System
```

### 2. Frontend Setup

```bash
npm install
```

### 3. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>
CEREBRAS_API_KEY=your_cerebras_api_key
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

### 4. PDF Processor Setup

```bash
cd pdf_processor
python -m venv venv
source venv/bin/activate    # Linux/Mac
# venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

## Running the Application

You need **4 terminals** running simultaneously:

### Terminal 1: Frontend
```bash
npm run dev
```
-> Runs on `http://localhost:5173`

### Terminal 2: Backend
```bash
cd backend
npm run dev
```
-> Runs on `http://localhost:5000`

### Terminal 3: PDF Processor
```bash
cd pdf_processor
source venv/bin/activate
python app.py
```
-> Runs on `http://localhost:5001`

### Terminal 4: ngrok (for OCR pipeline)
```bash
ngrok http 5000
```
-> Copy the HTTPS URL into the OCR Colab notebook

## Data Migration

If you already have data from before multi-teacher isolation was added, run the migration script to assign all existing data to a specific teacher:

```bash
cd backend
node migrate-teacher-data.js
```

> **Note:** Edit the script to set the correct `TEACHER_USER_ID` and `TEACHER_NAME` before running.

## Project Structure

```
Auto-Grade-System/
├── backend/
│   ├── config/
│   │   └── db.js                    # MongoDB connection
│   ├── controllers/
│   │   ├── paperController.js       # Paper CRUD (filtered by teacherId)
│   │   └── studentCsvController.js  # Student CSV upload (filtered by teacherId)
│   ├── middleware/
│   │   └── authMiddleware.js        # JWT auth — extracts teacherId
│   ├── models/
│   │   ├── Teacher.js               # Teacher account schema
│   │   ├── Paper.js                 # Question paper schema (nested Q/Part/SubPart)
│   │   ├── StudentCopy.js           # Processed student answer sheets
│   │   ├── StudentCsv.js            # Uploaded student name lists
│   │   ├── EvaluationResult.js      # LLM grading results per student
│   │   └── Course.js                # Shared course catalog
│   ├── routes/
│   │   ├── authRoutes.js            # Signup, Login, Forgot Password, Profile
│   │   ├── paperRoutes.js           # Question paper CRUD
│   │   ├── courseRoutes.js           # Course catalog (shared, no auth)
│   │   ├── studentCsvRoutes.js      # Student CSV upload
│   │   ├── studentCopyRoutes.js     # Student copy management
│   │   ├── answerSheetRoutes.js     # PDF upload → processing pipeline
│   │   ├── ocrRoutes.js             # OCR job queue & results
│   │   └── evaluationRoutes.js      # LLM evaluation & dashboard stats
│   ├── migrate-teacher-data.js      # One-time data migration script
│   ├── server.js                    # Express server entry point
│   └── package.json
├── pdf_processor/
│   ├── app.py                       # Flask API server
│   ├── processor.py                 # Image processing (QR, markers, crop)
│   ├── requirements.txt
│   └── venv/                        # Python virtual environment (gitignored)
├── src/
│   ├── components/
│   │   ├── Layout.tsx               # Sidebar navigation
│   │   ├── QuestionEditor.tsx       # Question paper editing UI
│   │   └── ...                      # Other UI components
│   ├── pages/
│   │   ├── Dashboard.tsx            # Overview stats
│   │   ├── UploadQuestionPapers.tsx # Paper upload & parsing
│   │   ├── UploadAnswerSheets.tsx   # Answer sheet processing
│   │   ├── DownloadAnswerSheets.tsx # Generate student-specific sheets
│   │   ├── StudentCopies.tsx        # View processed student copies
│   │   ├── StudentReports.tsx       # Grading results + Excel export
│   │   ├── Settings.tsx             # Profile management
│   │   └── Login.tsx / Signup.tsx   # Authentication pages
│   ├── services/
│   │   └── api.ts                   # API client (all endpoints + auth headers)
│   └── App.tsx                      # Main app component with routing
├── ocr_pipeline.ipynb               # Google Colab OCR notebook
├── .gitignore
├── package.json
└── README.md
```

## API Endpoints

### Authentication (no auth required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create teacher account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/forgot-password` | Send reset code via email |
| POST | `/api/auth/reset-password` | Reset password with code |

### Protected Routes (JWT required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/me` | Get current teacher |
| PUT | `/api/auth/update-profile` | Update profile |
| POST | `/api/papers/save` | Save question paper |
| GET | `/api/papers/` | Get teacher's papers |
| GET | `/api/papers/:id` | Get paper by ID |
| POST | `/api/student-tables/upload` | Upload student CSV |
| GET | `/api/student-tables/` | Get teacher's student tables |
| POST | `/api/answer-sheets/process` | Upload & process answer PDF |
| GET | `/api/student-copies/` | Get teacher's student copies |
| POST | `/api/evaluation/evaluate/:sessionId/:cmsId` | Trigger LLM evaluation |
| GET | `/api/evaluation/results/:sessionId` | Get evaluation results |
| PUT | `/api/evaluation/result/:sessionId/:cmsId` | Edit marks/feedback |
| GET | `/api/evaluation/sessions` | Get evaluation sessions |
| GET | `/api/evaluation/dashboard-stats` | Get dashboard stats |

### Shared Routes (no auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/courses/` | List all courses |
| GET | `/api/courses/search?q=` | Search courses |
| POST | `/api/courses/` | Create course |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URI` | MongoDB connection string | Yes |
| `CEREBRAS_API_KEY` | Cerebras LLM API key | Yes |
| `JWT_SECRET` | Secret for JWT token signing | Yes |
| `EMAIL_USER` | Gmail address for password reset | Yes |
| `EMAIL_PASS` | Gmail app password | Yes |
| `PORT` | Backend server port (default: 5000) | No |

## Security Notes

- `.env` files are gitignored and never committed
- All API routes (except auth and courses) are protected with JWT middleware
- Each teacher's data is isolated - teachers can only access their own papers, students, and evaluations
- Passwords are hashed with bcrypt
- File paths are validated against `TEMP_FOLDER` to prevent directory traversal

## Troubleshooting

### MongoDB Connection Issues
- Ensure your MongoDB Atlas IP whitelist includes your current IP
- Check `MONGO_URI` in `backend/.env`
- Test connection with MongoDB Compass

### PDF Processor Not Working
- Ensure Python venv is activated: `source pdf_processor/venv/bin/activate`
- Install system dependencies: `sudo apt install poppler-utils libzbar0`
- Check Flask is running on port 5001

### OCR Pipeline
- Ensure ngrok is running and the URL is updated in the Colab notebook
- The OCR notebook requires a Google Cloud Vision API key
