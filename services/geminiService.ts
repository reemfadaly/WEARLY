import { GoogleGenAI, Type } from "@google/genai";
import { Category } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Missing API Key. Please set API_KEY in your .env file (local) or Vercel Environment Variables.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- SYSTEM INSTRUCTIONS ---

const AVATAR_STYLE_INSTRUCTIONS = `
Model Guidelines:
- Use a neutral, generic realistic human fashion model (not a celebrity).
- Body: slim to average build, balanced proportions, natural posture.
- Face: soft features, neutral expression, minimal makeup.
- If modest wear is detected or implied: model wears a simple neutral hijab with clean wrapping and no distractions.
- The model should never overpower the clothing — the focus is always on the garment.

Clothing Rules (VERY IMPORTANT):
- The clothing must match the uploaded item exactly: same cut, silhouette, fabric behavior, embroidery, prints, logos, patterns, and color tones.
- Do NOT redesign, stylize, or “improve” the clothing.
- Fit the clothing naturally to the model while respecting its original oversized or fitted design.

Pose & Composition:
- Simple fashion pose (standing or slight angle).
- Hands relaxed (one hand near collar, pocket, or side).
- Upper body or 3/4 body framing.

Photography Style:
- Realistic studio photography (NOT illustration, NOT animation, NOT CGI).
- Clean white or light neutral background.
- Soft, diffused lighting with natural shadows.
- DSLR quality, sharp focus, realistic fabric texture.
- Minimal color grading, matte editorial finish.

Output Constraints:
- Final image must look like a real fashion photoshoot.
- No distortions, no warped fabric, no extra accessories.
- No text, watermarks, or logos.
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
        { text: "Generate a photorealistic professional headshot of a fashion model based on this person's features. Front facing, soft natural lighting, neutral expression, minimal makeup. Clean studio background. High texture detail." }
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
    parts.push({ text: "Use this face for the model, blending it realistically onto the body." });
  }

  const prompt = `
    ${AVATAR_STYLE_INSTRUCTIONS}
    Task: Generate a photorealistic fashion photo of a model wearing the provided Clothing Items.
    Layering: Apply items in the order provided (e.g. Item 1 under Item 2).
    If a face is provided, strictly maintain that facial appearance with realistic texture.
    If multiple items are uploaded (e.g. top and bottom), wear them together.
    ENSURE the clothing details (texture, pattern, logos) are preserved exactly as seen in the input images.
  `;
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: { imageConfig: { aspectRatio: "3:4" } }
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

/**
 * 5. Remove Background (Extract Garment)
 */
export const removeBackground = async (image: ImageInput): Promise<string> => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: image.base64, mimeType: image.mimeType } },
        { text: "Isolate the main clothing item from this image. Display ONLY the clothing item on a pure white background. Keep the item identical to the original, preserving all colors and textures." }
      ]
    },
    config: {
       imageConfig: { aspectRatio: "1:1" }
    }
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