// Simplified rename script - Using ES module syntax to match project configuration
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get current file path and directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define directory paths
const rootDir = path.resolve(__dirname, '..');
const defsHeaderDir = path.join(rootDir, 'defs_header');
const includeDir = path.join(rootDir, 'include');
const generatedDir = path.join(rootDir, 'generated');

// Copy header files from defs_header

// Copy node-addon-api header files
function copyNodeAddonApiHeaders() {
  console.log('Starting to copy node-addon-api header files...');
  
  try {
    // Find node-addon-api using import path
    let nodeAddonApiPath;
    try {
      // In ES modules, we can resolve module paths
      const nodeAddonApiModule = import.meta.resolve('node-addon-api');
      // Remove file:// prefix
      const modulePath = nodeAddonApiModule.startsWith('file://') 
        ? nodeAddonApiModule.slice(7) 
        : nodeAddonApiModule;
      nodeAddonApiPath = path.dirname(modulePath);
      console.log(`Found node-addon-api path: ${nodeAddonApiPath}`);
    } catch (e) {
      // Alternative: use relative path
      console.error('Cannot find node-addon-api module via import.meta.resolve, trying alternative path');
      nodeAddonApiPath = path.resolve(rootDir, 'node_modules/node-addon-api');
      if (!fs.existsSync(nodeAddonApiPath)) {
        console.error('Cannot find node-addon-api module, please ensure dependencies are installed');
        throw e;
      }
    }
    
    // Define files to copy
    const filesToCopy = [
      'napi.h',
      'napi-inl.h',
      'napi-inl.deprecated.h'
    ];
    
    // Copy each file
    for (const fileName of filesToCopy) {
      const srcPath = path.join(nodeAddonApiPath, fileName);
      const destPath = path.join(includeDir, fileName);
      
      try {
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`Copied: ${fileName}`);
        } else {
          console.error(`Source file does not exist: ${srcPath}`);
        }
      } catch (err) {
          console.error(`Failed to copy ${fileName}:`, err.message);
          // Continue trying to copy other files
        }
    }
  } catch (error) {
    console.error('Failed to copy node-addon-api header files:', error.message);
    // Do not throw error here, allow script to continue other operations
  }
}

// Copy header files from defs_header
function copyDefsHeaders() {
  console.log('Starting to copy defines header files...');
  
  try {
    // Ensure defsHeaderDir exists
    if (!fs.existsSync(defsHeaderDir)) {
      throw new Error(`defs_header directory does not exist: ${defsHeaderDir}`);
    }
    
    // Copy weak_napi_defines.h
    const definesSrc = path.join(defsHeaderDir, 'weak_napi_defines.h');
    const definesDest = path.join(includeDir, 'weak_napi_defines.h');
    if (fs.existsSync(definesSrc)) {
      fs.copyFileSync(definesSrc, definesDest);
      console.log(`Copied file: ${definesSrc} -> ${definesDest}`);
    } else {
      console.error(`Source file does not exist: ${definesSrc}`);
      throw new Error(`Source file does not exist: ${definesSrc}`);
    }
    
    // Copy weak_napi_undefs.h
    const undefsSrc = path.join(defsHeaderDir, 'weak_napi_undefs.h');
    const undefsDest = path.join(includeDir, 'weak_napi_undefs.h');
    if (fs.existsSync(undefsSrc)) {
      fs.copyFileSync(undefsSrc, undefsDest);
      console.log(`Copied file: ${undefsSrc} -> ${undefsDest}`);
    } else {
      console.error(`Source file does not exist: ${undefsSrc}`);
      throw new Error(`Source file does not exist: ${undefsSrc}`);
    }
  } catch (error) {
    console.error('Failed to copy header files:', error.message);
    throw error;
  }
}

// Process individual file
function processFile(filePath) {
  // Exclude weak_napi_defines.h and weak_napi_undefs.h files
  const fileName = path.basename(filePath);
  if (fileName === 'weak_napi_defines.h' || fileName === 'weak_napi_undefs.h') {
    console.log(`Skipping file: ${filePath}`);
    return;
  }
  
  console.log(`Processing file: ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const newLines = [...lines];
    
    // Special handling logic - Temporary hack
    // 1. Process napi.h
    if (fileName === 'napi.h') {
      console.log(`Applying special handling logic to napi.h`);
      
      // Find #include "napi-inl.h"
      let napiInlIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '#include "napi-inl.h"') {
          napiInlIndex = i;
          break;
        }
      }
      
      // Find the nearest #include before it
      if (napiInlIndex >= 0) {
        let prevIncludeIndex = -1;
        for (let i = napiInlIndex - 1; i >= 0; i--) {
          if (lines[i].trim().startsWith('#include')) {
            prevIncludeIndex = i;
            break;
          }
        }
        
        // Insert weak_napi_defines.h after the previous #include
        if (prevIncludeIndex >= 0) {
          newLines.splice(prevIncludeIndex + 1, 0, '#include "weak_napi_defines.h"');
        } else {
          // Fallback: if no previous include found, insert at beginning of file
          newLines.unshift('#include "weak_napi_defines.h"');
        }
      }
    }
    // 2. Process napi-inl.h
    else if (fileName === 'napi-inl.h') {
      console.log(`Applying special handling logic to napi-inl.h`);
      
      // Find #include "napi-inl.deprecated.h"
      let deprecatedIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '#include "napi-inl.deprecated.h"') {
          deprecatedIndex = i;
          break;
        }
      }
      
      // Find the nearest #include before it
      if (deprecatedIndex >= 0) {
        let prevIncludeIndex = -1;
        for (let i = deprecatedIndex - 1; i >= 0; i--) {
          if (lines[i].trim().startsWith('#include')) {
            prevIncludeIndex = i;
            break;
          }
        }
        
        // Insert weak_napi_defines.h after the previous #include
        if (prevIncludeIndex >= 0) {
          newLines.splice(prevIncludeIndex + 1, 0, '#include "weak_napi_defines.h"');
        } else {
          // Fallback: if no previous include found, insert at beginning of file
          newLines.unshift('#include "weak_napi_defines.h"');
        }
      }
    }
    // Default handling logic - For other files
    else {
      // Find the last #include statement
      let lastIncludeIndex = -1;
      
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('#include')) {
          lastIncludeIndex = i;
          break;
        }
      }
      
      // Add weak_napi_defines.h after the last #include
      if (lastIncludeIndex >= 0) {
        newLines.splice(lastIncludeIndex + 1, 0, '#include "weak_napi_defines.h"');
      } else {
        // If no #include found, add at beginning of file
        newLines.unshift('#include "weak_napi_defines.h"');
      }
    }
    
    // Add weak_napi_undefs.h at the end of the file
    // Ensure file ends with newline character
    if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== '') {
      newLines.push('');
    }
    newLines.push('#include "weak_napi_undefs.h"');
    newLines.push('');
    
    // Write back to file
    const newContent = newLines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    console.log(`Processed: ${filePath}`);
  } catch (error) {
    console.error(`Failed to process file ${filePath}:`, error.message);
    // Continue processing other files
  }
}

// Process directory
function processDirectorySync(directory) {
  console.log(`Starting to process directory: ${directory}`);
  
  try {
    if (!fs.existsSync(directory)) {
      console.log(`Directory does not exist, skipping: ${directory}`);
      return;
    }
    
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      
      try {
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          // Recursively process subdirectory
          processDirectorySync(filePath);
        } else if (file.endsWith('.h') || file.endsWith('.hpp') || file.endsWith('.c') || file.endsWith('.cpp')) {
          // Process source file
          processFile(filePath);
        }
      } catch (err) {
          console.error(`Cannot access file/directory ${filePath}:`, err.message);
          continue;
      }
    }
  } catch (error) {
    console.error(`Failed to process directory ${directory}:`, error.message);
  }
}

// Main function - Synchronous execution
function main() {
  try {
    console.log('Starting prebuild:rename operation...');
    
    // Ensure include directory exists
    if (!fs.existsSync(includeDir)) {
      fs.mkdirSync(includeDir, { recursive: true });
      console.log(`Created directory: ${includeDir}`);
    }
    
    // Step 1: Copy node-addon-api header files to include directory
    copyNodeAddonApiHeaders();
    
    // Step 2: Copy header files from defs_header to include directory
    copyDefsHeaders();
    
    // Step 3: Process all files in include directory
    if (fs.existsSync(includeDir) && fs.statSync(includeDir).isDirectory()) {
      processDirectorySync(includeDir);
    } else {
      console.error(`Include directory does not exist: ${includeDir}`);
    }
    
    // Step 4: Process all files in generated directory (if exists)
    if (fs.existsSync(generatedDir) && fs.statSync(generatedDir).isDirectory()) {
      processDirectorySync(generatedDir);
    } else {
      console.log(`Generated directory does not exist, skipping processing: ${generatedDir}`);
    }
    
    console.log('prebuild:rename operation completed!');
  } catch (error) {
    console.error('prebuild:rename operation failed:', error.message);
    console.error('Error stack:', error.stack || 'No stack information');
    process.exitCode = 1;
  }
}

// Execute main function
main();