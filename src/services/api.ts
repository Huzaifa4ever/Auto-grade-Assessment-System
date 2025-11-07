const API_BASE_URL = 'http://localhost:5000/api/papers';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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
