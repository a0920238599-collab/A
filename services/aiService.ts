import { GoogleGenAI } from "@google/genai";
import { OzonPosting } from "../types";

// Initialize Gemini Client
// IMPORTANT: In a real production app, never expose keys on the client. 
// This relies on the process.env.API_KEY being injected by the build environment.
const apiKey = process.env.API_KEY || '';
let ai: GoogleGenAI | null = null;

if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
}

export const analyzeSales = async (postings: OzonPosting[]): Promise<string> => {
  if (!ai) {
    return "API Key not configured. Unable to perform AI analysis. Please set the API_KEY environment variable.";
  }

  // Prepare a lightweight summary to avoid token limits
  const summaryData = postings.map(p => ({
    date: p.in_process_at.split('T')[0],
    products: p.products.map(prod => ({ name: prod.name, price: prod.price, currency: prod.currency_code })),
    status: p.status,
    region: p.analytics_data?.region || 'Unknown'
  })).slice(0, 30); // Analyze last 30 orders max

  const prompt = `
    作为一位专业的电商数据分析师，请根据以下Ozon订单数据（最近的订单）生成一份简短的中文销售日报。
    
    数据摘要:
    ${JSON.stringify(summaryData)}
    
    请包含以下内容：
    1. 销售总体趋势。
    2. 最畅销的产品是什么？
    3. 主要的销售区域分布。
    4. 给卖家的简短建议。
    
    请保持语气专业且鼓舞人心。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text || "无法生成分析结果。";
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "AI分析服务暂时不可用，请稍后再试。";
  }
};
