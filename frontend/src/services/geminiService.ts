import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("NEXT_PUBLIC_GEMINI_API_KEY not found in environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateComicAsset = async (prompt: string): Promise<string | null> => {
  const ai = getClient();
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: `Create a dynamic comic book panel illustration with bold ink outlines, cel-shading, and vibrant pop art colors. Use dramatic angles and expressive poses. Do NOT include any speech bubbles, text, captions, or dialogue boxes. Subject: ${prompt}`,
      config: {
        responseModalities: ['Text', 'Image'],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini generation error:", error);
    throw error;
  }
};

export const generateConceptFromSketch = async (
  imageBase64: string,
  prompt: string
): Promise<string | null> => {
  const ai = getClient();
  if (!ai) {
    throw new Error("API Key is missing");
  }

  try {
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        `Transform this rough sketch into a polished comic book style artwork. Use bold ink outlines, dynamic cel-shading, and rich saturated colors inspired by graphic novels. Maintain the original composition and pose from the sketch. Do NOT add any speech bubbles, text, captions, or dialogue boxes. Style: ${prompt}`,
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Data,
          },
        },
      ],
      config: {
        responseModalities: ['Text', 'Image'],
      },
    });

    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
