# Auto Grade System

An automated grading system for question papers with LLM-powered evaluation capabilities.

## Features

- Upload and parse question papers (PDF)
- Extract questions, parts, sub-parts, and marks
- Edit parsed question papers with an intuitive UI
- Save question papers to database
- Upload answer sheets (PDF with multiple images)
- Select question paper for evaluation
- LLM integration for automated grading (Google Generative AI)

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- PDF.js for PDF text extraction
- Custom CSS modules for styling

### Backend
- Node.js with Express
- MongoDB for database
- Mongoose for ODM
- Google Generative AI for LLM capabilities
- CORS enabled

## Prerequisites

Before running this project, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v6 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **Git** - [Download](https://git-scm.com/)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Auto-Grade-System
```

### 2. Backend Setup

```bash
cd backend
npm install
```

#### Configure Environment Variables

Create a `.env` file in the `backend` directory:

Edit `.env` with your configuration:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/auto-grade-system
GOOGLE_API_KEY=your_google_generative_ai_api_key_here
```

**Getting Google API Key:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create or select a project
3. Generate an API key
4. Copy the key to your `.env` file

### 3. Frontend Setup

```bash
cd ..
npm install
```

## Running the Application

### Start MongoDB (if not running as a service)

#### On Linux:
```bash
sudo systemctl start mongod
```

#### On Windows:
```bash
net start MongoDB
```

Or start MongoDB Compass and connect to `mongodb://localhost:27017`

### Start Backend Server

```bash
cd backend
npm run dev
```

The backend will run on `http://localhost:5000`

### Start Frontend Development Server

Open a new terminal:

```bash
npm run dev
```

The frontend will run on `http://localhost:5173` (or another port if 5173 is busy)

## Usage

### 1. Upload Question Papers

1. Navigate to **Upload Question Papers** page
2. Click **Upload PDF** to select a question paper PDF
3. The system will extract and parse the content
4. Review and edit the parsed questions, parts, sub-parts, and marks
5. Click **Save to Database**
6. Enter a name for the question paper (e.g., "IR-sec-D")
7. Paper is saved to the database

### 2. Upload Answer Sheets

1. Navigate to **Upload Answer Sheets** page
2. Click **Upload PDF** to select a PDF containing answer sheets (can contain up to 200 images)
3. Select a question paper from the dropdown list
4. Click **Evaluate** (LLM evaluation functionality to be completed)

## Project Structure

```
Auto-Grade-System/
├── backend/
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── controllers/
│   │   └── paperController.js # Paper CRUD operations
│   ├── models/
│   │   └── Paper.js           # Paper schema
│   ├── routes/
│   │   └── paperRoutes.js     # API routes
│   ├── .env.example           # Environment variables template
│   ├── package.json
│   └── server.js              # Express server
├── src/
│   ├── components/
│   │   ├── Layout.tsx         # Main layout
│   │   └── QuestionEditor.tsx # Question editing UI
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── UploadQuestionPapers.tsx
│   │   ├── UploadAnswerSheets.tsx
│   │   ├── StudentReports.tsx
│   │   └── Settings.tsx
│   ├── services/
│   │   └── api.ts             # API client
│   ├── utils/
│   │   ├── parser.ts          # Question paper parser
│   │   └── pdfText.ts         # PDF text extraction
│   ├── types.ts               # TypeScript types
│   └── App.tsx                # Main app component
├── .gitignore
├── package.json
└── README.md
```

## API Endpoints

### Papers

- `POST /api/papers/save` - Save a question paper
- `GET /api/papers/` - Get all question papers

### Rubric Generation

- `POST /api/generate-rubric` - Generate rubric using LLM (expects `{ question: string }`)

## Parser Features

The custom parser supports:

- **Question labels:** Q1, Q2, Question 1, Q.1, Q-1, Q 5 .
- **Parts:** a), b), c), etc.
- **Sub-parts:** (i), (ii), (iii), ( i ), ( ii ), etc. (with or without spaces)
- **Marks:** (2 Marks), (1.5 Marks), etc.
- **Inline parts:** Detects multiple parts on the same line
- **Mixed structures:** Handles questions with nested parts and sub-parts

## Troubleshooting

### MongoDB Connection Issues

**Error:** `MongooseServerSelectionError: connect ECONNREFUSED`

**Solution:**
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- On Linux: `sudo systemctl status mongod`
- On Windows: Check Services for MongoDB

### Port Already in Use

**Backend (5000):**
```bash
# Linux
lsof -i :5000
kill -9 <PID>

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**Frontend (5173):**
The Vite dev server will automatically use the next available port.

### Missing Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ..
npm install
```

## Development

### Build for Production

#### Frontend
```bash
npm run build
```
Output will be in `dist/` directory.

#### Backend
No build step required. Run with:
```bash
cd backend
npm start
```

### Linting and Type Checking

```bash
# Type checking
npx tsc --noEmit
```

## Environment Variables

### Backend (.env)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Backend server port | No | 5000 |
| `MONGODB_URI` | MongoDB connection string | Yes | mongodb://localhost:27017/auto-grade-system |
| `GOOGLE_API_KEY` | Google Generative AI API key | Yes | - |

## Security Notes

- `.env` files are gitignored and never committed
- Sensitive API keys are stored in `.env` only
- Use `.env.example` as a template
- MongoDB connection should use authentication in production

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly on both Windows and Linux
4. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions, please open an issue on the GitHub repository.
