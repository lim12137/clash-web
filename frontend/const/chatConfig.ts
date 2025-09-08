// Chat related configuration
export const chatConfig = {
  // Supported text file MIME types
  textTypes: [
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "application/json",
    "application/xml",
    "text/markdown",
  ],

  // Supported text file extensions
  textExtensions: [
    "txt",
    "html",
    "htm",
    "css",
    "js",
    "ts",
    "jsx",
    "tsx",
    "json",
    "xml",
    "md",
    "markdown",
    "csv",
  ],

  // File limit configuration
  maxFileCount: 50,
  maxFileSize: 5 * 1024 * 1024, // Maximum 5MB per file
  
  // Supported image file extensions
  imageExtensions: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"],
  
  // Supported document file extensions
  documentExtensions: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"],
  
  // Supported text document extensions
  supportedTextExtensions: ["md", "markdown", "txt"],

  // File icon mapping configuration
  fileIcons: {
    // PDF files
    pdf: ["pdf"],
    
    // Word documents
    word: ["doc", "docx"],
    
    // Plain text files
    text: ["txt"],
    
    // Markdown files
    markdown: ["md"],
    
    // Excel spreadsheet files
    excel: ["xls", "xlsx", "csv"],
    
    // PowerPoint presentation files
    powerpoint: ["ppt", "pptx"],
    
    // HTML files
    html: ["html", "htm"],
    
    // Code files
    code: ["css", "js", "ts", "jsx", "tsx", "php", "py", "java", "c", "cpp", "cs"],
    
      // JSON files
  json: ["json"],
},

// File preview type constants
filePreviewTypes: {
  image: "image" as const,
  file: "file" as const,
},
};
