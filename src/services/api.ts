const API_BASE_URL = 'http://localhost:5000/api/papers';
const STUDENT_TABLE_API_BASE_URL = 'http://localhost:5000/api/student-tables';
const ANSWER_SHEET_API_BASE_URL = 'http://localhost:5000/api/answer-sheets';
const AUTH_API_BASE_URL = 'http://localhost:5000/api/auth';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthResponse {
  token: string;
  teacher: { name: string; email: string; userId: string };
}

export async function signup(name: string, email: string, userId: string, password: string): Promise<ApiResponse<AuthResponse>> {
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, userId, password }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Signup failed' };
    }
    return { success: true, data: { token: data.token, teacher: data.teacher } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Signup failed' };
  }
}

export async function login(userId: string, password: string): Promise<ApiResponse<AuthResponse>> {
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Login failed' };
    }
    return { success: true, data: { token: data.token, teacher: data.teacher } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Login failed' };
  }
}

export async function getMe(token: string): Promise<ApiResponse<{ name: string; email: string; userId: string }>> {
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Session expired' };
    }
    return { success: true, data: data.teacher };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to verify session' };
  }
}

export async function forgotPassword(email: string): Promise<ApiResponse<{ message: string; devCode?: string }>> {
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to send reset code' };
    }
    return { success: true, data: { message: data.message, devCode: data.devCode } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send reset code' };
  }
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to reset password' };
    }
    return { success: true, data: { message: data.message } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to reset password' };
  }
}

export interface UpdateProfileData {
  name: string;
  email: string;
  userId: string;
  currentPassword: string;
  newPassword?: string;
}

export interface UpdateProfileResponse {
  message: string;
  token: string;
  teacher: { name: string; email: string; userId: string };
}

export async function updateProfile(data: UpdateProfileData): Promise<ApiResponse<UpdateProfileResponse>> {
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/update-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Failed to update profile' };
    }
    return { success: true, data: { message: result.message, token: result.token, teacher: result.teacher } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update profile' };
  }
}

export interface Student {
  cmsId: string;
  name: string;
}

export interface StudentTable {
  _id: string;
  name: string;
  originalFileName?: string;
  students: Student[];
  createdAt?: string;
  updatedAt?: string;
}

export async function savePaper(paperData: any): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${API_BASE_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(paperData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error saving paper:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save paper'
    };
  }
}

export async function getAllPapers(): Promise<ApiResponse<any[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/`, {
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching papers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch papers'
    };
  }
}

export async function uploadStudentTable(payload: {
  name: string;
  originalFileName?: string;
  students: Student[];
}): Promise<ApiResponse<StudentTable>> {
  try {
    const response = await fetch(`${STUDENT_TABLE_API_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error uploading student table:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload student table',
    };
  }
}

export async function getStudentTables(): Promise<ApiResponse<StudentTable[]>> {
  try {
    const response = await fetch(`${STUDENT_TABLE_API_BASE_URL}/`, {
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching student tables:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch student tables',
    };
  }
}

export async function parsePdfTextWithGemini(extractedText: string): Promise<ApiResponse<any>> {
  try {
    const response = await fetch('http://localhost:5000/api/parse-pdf-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ extractedText }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data: data.structure };
  } catch (error) {
    console.error('Error parsing PDF text with Gemini:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse PDF text with Gemini',
    };
  }
}

const COURSE_API_BASE_URL = 'http://localhost:5000/api/courses';

export async function getCourses(): Promise<ApiResponse<any[]>> {
  try {
    const response = await fetch(`${COURSE_API_BASE_URL}/`, {
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching courses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch courses',
    };
  }
}

export async function searchCourses(query: string): Promise<ApiResponse<any[]>> {
  try {
    const response = await fetch(`${COURSE_API_BASE_URL}/search?q=${encodeURIComponent(query)}`, {
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error searching courses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search courses',
    };
  }
}

export async function createCourse(course: {
  courseCode: string;
  courseName: string;
  department: string;
}): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${COURSE_API_BASE_URL}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(course),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error creating course:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create course',
    };
  }
}

export async function updateCourse(id: string, course: {
  courseCode: string;
  courseName: string;
  department: string;
}): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${COURSE_API_BASE_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(course),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error updating course:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update course',
    };
  }
}

export async function deleteCourse(id: string): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${COURSE_API_BASE_URL}/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error deleting course:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete course',
    };
  }
}

export interface ProcessedStudent {
  cms_id: string;
  section: string;
  course_code: string;
  total_pages: number;
  cropped_images: string[];
}

export interface ProcessingResult {
  success: boolean;
  session_id: string;
  students: ProcessedStudent[];
  error?: string;
}

export interface SessionData {
  session_id: string;
  created_at: string;
  students: {
    cms_id: string;
    has_cover: boolean;
    cropped_images: string[];
  }[];
}

export async function processAnswerSheets(
  file: File,
  paperId: string
): Promise<ApiResponse<ProcessingResult>> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('paper_id', paperId);

    const response = await fetch(`${ANSWER_SHEET_API_BASE_URL}/process`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error processing answer sheets:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process answer sheets',
    };
  }
}

export async function getAnswerSheetSessions(): Promise<ApiResponse<SessionData[]>> {
  try {
    const response = await fetch(`${ANSWER_SHEET_API_BASE_URL}/sessions`, {
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data: data.sessions };
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sessions',
    };
  }
}

export async function deleteAnswerSheetSession(sessionId: string): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${ANSWER_SHEET_API_BASE_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error deleting session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete session',
    };
  }
}

export async function clearAllAnswerSheets(): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${ANSWER_SHEET_API_BASE_URL}/clear-all`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error clearing answer sheets:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear answer sheets',
    };
  }
}

export async function checkAnswerSheetServiceHealth(): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${ANSWER_SHEET_API_BASE_URL}/health`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error checking service health:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Service unavailable',
    };
  }
}

export function getAnswerSheetImageUrl(imagePath: string): string {
  return `${ANSWER_SHEET_API_BASE_URL}/images/${imagePath}`;
}

// Student Copy Types and API
const STUDENT_COPY_API_BASE_URL = 'http://localhost:5000/api/student-copies';

export interface StudentCopyStudent {
  cmsId: string;
  name: string;
  section: string;
  courseCode: string;
  totalPages: number;
  pdfPath: string | null;
}

export interface StudentCopySession {
  _id: string;
  sessionId: string;
  paperId: string | { _id: string; name?: string; courseCode?: string } | null;
  students: StudentCopyStudent[];
  createdAt: string;
  updatedAt: string;
}

export function getStudentPdfUrl(sessionId: string, cmsId: string): string {
  return `${ANSWER_SHEET_API_BASE_URL}/pdf/${sessionId}/${encodeURIComponent(cmsId)}`;
}

export async function getStudentCopies(): Promise<ApiResponse<StudentCopySession[]>> {
  try {
    const response = await fetch(`${STUDENT_COPY_API_BASE_URL}/`, {
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data: data.sessions };
  } catch (error) {
    console.error('Error fetching student copies:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch student copies',
    };
  }
}

export async function deleteStudentCopySession(sessionId: string): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${STUDENT_COPY_API_BASE_URL}/${sessionId}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error deleting student copy session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete session',
    };
  }
}

export async function deleteStudentFromSession(
  sessionId: string,
  cmsId: string
): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(
      `${STUDENT_COPY_API_BASE_URL}/${sessionId}/students/${encodeURIComponent(cmsId)}`,
      {
        method: 'DELETE',
        headers: { ...authHeaders() },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error deleting student from session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete student',
    };
  }
}

export async function clearAllStudentCopies(): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${STUDENT_COPY_API_BASE_URL}/`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error clearing student copies:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear student copies',
    };
  }
}

// ============================================================
// Evaluation API
// ============================================================
const EVALUATION_API_BASE_URL = 'http://localhost:5000/api/evaluation';

export interface QuestionResult {
  questionKey: string;
  questionText: string;
  maxMarks: number;
  obtainedMarks: number;
  feedback: string;
  studentAnswer: string;
  rubrics: string[];
  edited: boolean;
  ocrConfidence: number;
  llmConfidence: number;
}

export interface EvaluationResultData {
  _id: string;
  sessionId: string;
  paperId: string;
  cmsId: string;
  studentName: string;
  section: string;
  courseCode: string;
  status: 'pending' | 'evaluating' | 'completed' | 'error';
  totalMarks: number;
  obtainedMarks: number;
  questions: QuestionResult[];
  ocrAccuracy: number;
  llmAccuracy: number;
  errorMessage?: string;
  evaluatedAt?: string;
  editedAt?: string;
}

export interface EvaluationSession {
  sessionId: string;
  courseCode: string;
  section: string;
  totalStudents: number;
  completedStudents: number;
  avgScore: number;
  totalMarks: number;
  avgOcrAccuracy: number;
  avgLlmAccuracy: number;
  updatedAt: string;
}

export async function getEvaluationSessions(): Promise<ApiResponse<EvaluationSession[]>> {
  try {
    const response = await fetch(`${EVALUATION_API_BASE_URL}/sessions`, {
      headers: { ...authHeaders() },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data: data.sessions };
  } catch (error) {
    console.error('Error fetching evaluation sessions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch evaluation sessions',
    };
  }
}

export async function getEvaluationResults(sessionId: string): Promise<ApiResponse<EvaluationResultData[]>> {
  try {
    const response = await fetch(`${EVALUATION_API_BASE_URL}/results/${sessionId}`, {
      headers: { ...authHeaders() },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data: data.results };
  } catch (error) {
    console.error('Error fetching evaluation results:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch evaluation results',
    };
  }
}

export async function getEvaluationResult(sessionId: string, cmsId: string): Promise<ApiResponse<EvaluationResultData>> {
  try {
    const response = await fetch(`${EVALUATION_API_BASE_URL}/result/${sessionId}/${encodeURIComponent(cmsId)}`, {
      headers: { ...authHeaders() },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data: data.result };
  } catch (error) {
    console.error('Error fetching evaluation result:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch evaluation result',
    };
  }
}

export async function updateEvaluationResult(
  sessionId: string,
  cmsId: string,
  questions: { questionKey: string; obtainedMarks?: number; feedback?: string }[]
): Promise<ApiResponse<EvaluationResultData>> {
  try {
    const response = await fetch(`${EVALUATION_API_BASE_URL}/result/${sessionId}/${encodeURIComponent(cmsId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ questions }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data: data.result };
  } catch (error) {
    console.error('Error updating evaluation result:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update evaluation result',
    };
  }
}

export async function triggerEvaluation(sessionId: string, cmsId: string): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${EVALUATION_API_BASE_URL}/evaluate/${sessionId}/${encodeURIComponent(cmsId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error triggering evaluation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger evaluation',
    };
  }
}

export interface DashboardStats {
  totalEvaluated: number;
  avgOcrAccuracy: number;
  avgLlmAccuracy: number;
}

export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  try {
    const response = await fetch(`${EVALUATION_API_BASE_URL}/dashboard-stats`, {
      headers: { ...authHeaders() },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data: data.stats };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard stats',
    };
  }
}

export interface LlmConfig {
  provider: string;
  model: string;
  apiKeySet: boolean;
  apiKeyPreview: string;
  endpoint: string;
  rpm: number;
  tpm: number;
  fallbackEnabled: boolean;
  lastTested: string | null;
  lastStatus: string | null;
}

export async function getLlmConfig(): Promise<ApiResponse<LlmConfig>> {
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/llm-config`, {
      headers: { ...authHeaders() },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data: data.config };
  } catch (error) {
    console.error('Error fetching LLM config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch LLM config',
    };
  }
}

export async function setLlmConfig(config: {
  provider: string;
  model?: string;
  apiKey?: string;
  endpoint?: string;
  rpm?: number;
  tpm?: number;
  fallbackEnabled?: boolean;
}): Promise<ApiResponse<LlmConfig>> {
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/llm-config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data: data.config };
  } catch (error) {
    console.error('Error setting LLM config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update LLM config',
    };
  }
}

export async function testLlmConnection(params: {
  provider: string;
  apiKey?: string;
  endpoint?: string;
  model?: string;
}): Promise<ApiResponse<{ message: string; detectedRpm: number | null; detectedTpm: number | null; model: string }>> {
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/test-llm-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.success) {
      return { success: false, error: data.error, data };
    }
    return { success: true, data };
  } catch (error) {
    console.error('Error testing LLM connection:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    };
  }
}
