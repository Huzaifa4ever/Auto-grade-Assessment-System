const API_BASE_URL = 'http://localhost:5000/api/papers';
const STUDENT_TABLE_API_BASE_URL = 'http://localhost:5000/api/student-tables';
const ANSWER_SHEET_API_BASE_URL = 'http://localhost:5000/api/answer-sheets';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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
    const response = await fetch(`${API_BASE_URL}/`);

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
    const response = await fetch(`${STUDENT_TABLE_API_BASE_URL}/`);

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
    const response = await fetch(`${COURSE_API_BASE_URL}/`);

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
    const response = await fetch(`${COURSE_API_BASE_URL}/search?q=${encodeURIComponent(query)}`);

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
    const response = await fetch(`${ANSWER_SHEET_API_BASE_URL}/sessions`);

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
    const response = await fetch(`${STUDENT_COPY_API_BASE_URL}/`);

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
      { method: 'DELETE' }
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
