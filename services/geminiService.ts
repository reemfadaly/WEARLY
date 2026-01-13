import { GoogleGenAI, Type } from "@google/genai";
import { Category } from "../types";

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- SYSTEM INSTRUCTIONS ---

const AVATAR_STYLE_INSTRUCTIONS = `
Style: 3D Game Character / Snapchat Bitmoji style.
Body: Female mannequin, consistent proportions, standing front-facing.
Vibe: Clean, minimal, studio lighting.
NO: Realism, messy backgrounds, distorted limbs.
`;

const REAL_STYLE_INSTRUCTIONS = `
Style: High-end fashion magazine lay-flat (2D collage).
Vibe: Realistic textures, clean arrangement, white/neutral background.
Action: Arrange the provided clothing items into a cohesive outfit layout.
NO: Avatars, cartoons, body parts (unless model photo provided).
`;

// --- HELPER INTERFACES ---

interface ImageInput {
  base64: string;
  mimeType: string;
}

// --- API METHODS ---

/**
 * 1. Create User Avatar (Face only)
 */
export const createProfileAvatar = async (faceImage: ImageInput): Promise<string> => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: faceImage.base64, mimeType: faceImage.mimeType } },
        { text: "Generate a cute 3D stylized avatar headshot based on this person's features. Front facing, neutral expression, soft studio lighting, game-character style. White background." }
      ]
    },
    config: {
      imageConfig: { aspectRatio: "1:1" }
    }
  });

  return extractImage(response);
};

/**
 * 2. Categorize Wardrobe Item
 */
export const categorizeItem = async (image: ImageInput): Promise<{ category: Category, description: string }> => {
  const ai = getAiClient();
  
  // Using gemini-3-flash-preview for text analysis of images
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: image.base64, mimeType: image.mimeType } },
        { text: "Analyze this fashion item. Return a JSON object with 'category' (one of: Top, Bottom, One-Piece, Shoes, Bag, Accessory, Outerwear) and a short 10-word 'description' of color/pattern." }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: ['Top', 'Bottom', 'One-Piece', 'Shoes', 'Bag', 'Accessory', 'Outerwear'] },
          description: { type: Type.STRING }
        }
      }
    }
  });

  try {
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse categorization", e);
    return { category: 'Accessory', description: 'Unknown item' };
  }
};

/**
 * 3. Generate Styled Avatar (Full Body)
 */
export const generateAvatarStyle = async (
  clothes: ImageInput[], 
  userAvatarFace?: string
): Promise<string> => {
  const ai = getAiClient();
  const parts: any[] = [];

  // Add clothes with indexing text to imply order if needed, 
  // though 2.5 flash image handles visual context well.
  clothes.forEach((img, index) => {
    parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
    parts.push({ text: `Clothing Item ${index + 1} (Layering order: ${index === 0 ? 'Inner/Base' : 'Outer'}).` });
  });

  // Add User Face if available
  if (userAvatarFace) {
    // Strip Data URL prefix if present (e.g. "data:image/png;base64,...")
    const base64Face = userAvatarFace.includes(',') 
      ? userAvatarFace.split(',')[1] 
      : userAvatarFace;

    parts.push({ inlineData: { data: base64Face, mimeType: 'image/png' } });
    parts.push({ text: "Use this 3D character face for the avatar." });
  }

  const prompt = `
    ${AVATAR_STYLE_INSTRUCTIONS}
    Task: Create a full-body 3D avatar wearing an outfit inspired by the provided Clothing Items.
    Layering: Apply items in the order provided (e.g. Item 1 under Item 2).
    If a character face is provided, strictly maintain that facial appearance.
    If multiple items are uploaded (e.g. top and bottom), wear them together.
    If a moodboard/full outfit photo is provided, separate the items visually on the avatar.
  `;
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  return extractImage(response);
};

/**
 * 4. Generate 2D Outfit (Real Photos)
 */
export const generateRealOutfit = async (clothes: ImageInput[]): Promise<string> => {
  const ai = getAiClient();
  const parts: any[] = [];

  clothes.forEach((img) => {
    parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
  });

  const prompt = `
    ${REAL_STYLE_INSTRUCTIONS}
    Task: Create a professional 'Outfit Grid' or 'Lay-flat' photography composition.
    Items: Include all the provided clothing items.
    Style: Realistic, high resolution, remove backgrounds of individual items and place them on a clean white/grey studio surface.
    Arrangement: Neatly folded or laid out as if ready to wear.
    Do NOT generate a human or avatar. Just the clothes.
  `;
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: { imageConfig: { aspectRatio: "3:4" } }
  });

  return extractImage(response);
};

// Helper
const extractImage = (response: any): string => {
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated.");
};
