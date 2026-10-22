export const ImageInputMeta = {
  "name": "ImageInput",
  "tier": "P0",
  "hint": "Let the user take or pick a photo, usually before an ai.run step.",
  "example": {
    "bind": "photo",
    "label": "Photo"
  },
  "children": false,
  "capabilities": [
    "camera",
    "photoLibrary"
  ]
} as const;
