export interface GeminiAnalysisResult {
  holderName: string;
  documentType: string;
  maskedId: string;
  issuingAuthority: string;
  issueDate?: string;
  ageOver18: boolean;
  claims: Record<string, string>;
  summary: string;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

/**
 * Analyzes OCR extracted text using Google Gemini Flash to extract normalized claims
 */
export async function analyzeDocumentWithGemini(
  ocrText: string,
  expectedDocType: string
): Promise<GeminiAnalysisResult | null> {
  try {
    const prompt = `You are a privacy-first identity document analysis engine for VERIMASK.
Analyze the following document OCR text:
---
${ocrText}
---
Expected Document Type: ${expectedDocType}

Return a clean, valid JSON object (no markdown formatting, no code blocks) with the following fields:
{
  "holderName": "Extracted Full Name (or 'Aarav Sharma')",
  "documentType": "${expectedDocType}",
  "maskedId": "Masked format like XXXX-XXXX-9021 or ABCDE••••F",
  "issuingAuthority": "e.g., UIDAI, Income Tax Department, CBSE, etc.",
  "issueDate": "YYYY-MM-DD or readable date",
  "ageOver18": true or false,
  "claims": {
    "Nationality": "Indian Citizen",
    "Age Verification": "Age > 18 Confirmed",
    "Status": "Valid"
  },
  "summary": "Brief 1-sentence verification summary"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn('Gemini API call returned status', response.status);
      return null;
    }

    const data = await response.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) return null;

    // Clean any backticks if Gemini wrapped in ```json
    const cleanedJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedJson) as GeminiAnalysisResult;
  } catch (err) {
    console.warn('Gemini analysis failed or JSON parse error:', err);
    return null;
  }
}
