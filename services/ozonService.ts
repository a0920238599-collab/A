import { OzonCredentials, OzonApiResponse, OzonPostingRequest, OzonPosting } from '../types';

const BASE_URL = 'https://api-seller.ozon.ru';

// Helper to generate mock data (Left for reference or explicit dev testing, but disabled in production flow)
const generateMockPostings = (count: number, clientId: string = 'mock'): OzonPosting[] => {
  // Mock generation logic removed from active path as per request
  return []; 
};

// Internal function to fetch for a single store
const fetchOrdersForStore = async (credentials: OzonCredentials, days: number): Promise<OzonPosting[]> => {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - days);

  let allPostings: OzonPosting[] = [];
  let offset = 0;
  // Reduced limit from 1000 to 100 to prevent 'Bad Request' errors due to payload size or timeout
  const limit = 100; 
  let hasNext = true;

  try {
    while (hasNext) {
        const requestBody: OzonPostingRequest = {
            dir: 'DESC',
            filter: {
                since: fromDate.toISOString(),
                to: toDate.toISOString(),
            },
            limit: limit,
            offset: offset,
            with: {
                analytics_data: true,
                barcodes: false,
                financial_data: true,
                translit: true
            }
        };

        const response = await fetch(`${BASE_URL}/v3/posting/fbs/list`, {
            method: 'POST',
            headers: {
                'Client-Id': credentials.clientId,
                'Api-Key': credentials.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            let errorDetail = "";
            try {
                // Attempt to parse Ozon's detailed error message
                const errorBody = await response.json();
                if (errorBody && errorBody.message) {
                    errorDetail = errorBody.message;
                } else if (errorBody && errorBody.error && errorBody.error.message) {
                    errorDetail = errorBody.error.message;
                } else {
                    errorDetail = JSON.stringify(errorBody);
                }
            } catch (e) {
                errorDetail = await response.text();
            }

            if (response.status === 401 || response.status === 403) {
                 throw new Error(`Client ID 或 API Key 无效 (${errorDetail})`);
            }
            // Include the specific error detail for 400s
            throw new Error(`API Error ${response.status}: ${errorDetail}`);
        }

        const data: OzonApiResponse = await response.json();
        const pagePostings = data.result.postings || [];
        
        // Accumulate results
        allPostings = [...allPostings, ...pagePostings];
        
        hasNext = data.result.has_next;
        offset += limit;

        if (offset > 10000) break; // Safety limit per store
    }
    
    // Tag the orders with the clientId so we know which store they belong to
    return allPostings.map(p => ({ ...p, clientId: credentials.clientId }));

  } catch (error) {
    console.error(`Failed to fetch for store ${credentials.clientId}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : "连接失败";
    // Alert the user about the error, as requested
    alert(`店铺 [${credentials.clientId}] 数据获取失败: ${errorMessage}。请检查凭证是否正确。`);

    // Return empty array instead of mock data
    return [];
  }
};

// Public aggregated fetch function
export const fetchAggregatedOrders = async (credentialsList: OzonCredentials[], days: number = 15): Promise<OzonPosting[]> => {
  if (!credentialsList || credentialsList.length === 0) return [];

  const promises = credentialsList.map(cred => fetchOrdersForStore(cred, days));
  
  // Wait for all requests to finish (success or handled failure)
  const results = await Promise.all(promises);
  
  // Flatten the array of arrays
  const aggregated = results.flat();
  
  // Sort combined results by date descending
  return aggregated.sort((a, b) => new Date(b.in_process_at).getTime() - new Date(a.in_process_at).getTime());
};

// Deprecated single fetch (kept for compatibility or mapped to aggregated)
export const fetchOrders = async (credentials: OzonCredentials, days: number = 15): Promise<OzonPosting[]> => {
    return fetchAggregatedOrders([credentials], days);
};

export const fetchPackageLabel = async (credentialsList: OzonCredentials[], postingNumbers: string[], targetClientId?: string): Promise<Blob> => {
    // If we know the target Client ID (from the order tag), find the specific credential
    const cred = credentialsList.find(c => c.clientId === targetClientId) || credentialsList[0];

    try {
        const response = await fetch(`${BASE_URL}/v2/posting/fbs/package-label`, {
            method: 'POST',
            headers: {
                'Client-Id': cred.clientId,
                'Api-Key': cred.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ posting_number: postingNumbers }),
        });

        if (!response.ok) {
            let errorDetail = "";
            try {
                const errorBody = await response.json();
                errorDetail = errorBody.message || JSON.stringify(errorBody);
            } catch (e) {
                 errorDetail = response.statusText;
            }
            throw new Error(`Failed to fetch labels: ${response.status} ${errorDetail}`);
        }

        return await response.blob();
    } catch (error) {
        console.error("Label fetch failed:", error);
        // Do NOT generate mock label, let the caller handle the error.
        throw error;
    }
};