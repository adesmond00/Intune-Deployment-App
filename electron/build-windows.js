const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const appDir = path.resolve(__dirname, '..');
const frontendDir = path.join(appDir, 'front-end');
const pythonResourceDir = path.join(__dirname, 'resources', 'python');

console.log('Building Intune Deployment App for Windows...');

// Step 1: Ensure resource directories exist
console.log('Creating resource directories...');
if (!fs.existsSync(pythonResourceDir)) {
  fs.mkdirSync(pythonResourceDir, { recursive: true });
}

// Step 2: Build the Next.js frontend
console.log('Building Next.js frontend...');
process.chdir(frontendDir);
execSync('npm run build', { stdio: 'inherit' });
execSync('npm run export', { stdio: 'inherit' });
console.log('Frontend build complete.');

// Step 3: Create Python embeddable package
console.log('Setting up Python environment...');
process.chdir(appDir);

// This script assumes you're building on Windows and have the embeddable Python package
// If building on Linux for Windows target, we need to download the embeddable package first
try {
  console.log('Downloading Python embeddable package...');
  execSync(
    'curl -L https://www.python.org/ftp/python/3.11.5/python-3.11.5-embed-amd64.zip -o python-embed.zip',
    { stdio: 'inherit' }
  );

  console.log('Extracting Python embeddable package...');
  execSync(`unzip -o python-embed.zip -d "${pythonResourceDir}"`, { stdio: 'inherit' });
  
  // Install pip in the embeddable package
  console.log('Installing pip in embeddable Python...');
  execSync(
    `curl -L https://bootstrap.pypa.io/get-pip.py -o get-pip.py && "${pythonResourceDir}/python.exe" get-pip.py`,
    { stdio: 'inherit' }
  );
  
  // Modify python3X._pth file to allow loading external modules
  const pthFiles = fs.readdirSync(pythonResourceDir).filter(file => file.endsWith('._pth'));
  if (pthFiles.length > 0) {
    const pthFile = path.join(pythonResourceDir, pthFiles[0]);
    let pthContent = fs.readFileSync(pthFile, 'utf-8');
    // Uncomment import site to allow pip to work
    pthContent = pthContent.replace('#import site', 'import site');
    fs.writeFileSync(pthFile, pthContent);
  }

  // Install required Python packages from requirements.txt
  console.log('Installing Python dependencies...');
  execSync(
    `"${pythonResourceDir}/python.exe" -m pip install -r requirements.txt --no-warn-script-location`,
    { stdio: 'inherit' }
  );
  
  // For msal and other packages that might not work with embeddable Python
  console.log('Installing additional Python dependencies...');
  execSync(
    `"${pythonResourceDir}/python.exe" -m pip install msal fastapi uvicorn python-dotenv --no-warn-script-location`,
    { stdio: 'inherit' }
  );
  
  console.log('Python environment setup complete.');
} catch (error) {
  console.error('Failed to set up Python environment:', error);
  console.log('WARNING: You will need to set up the Python environment manually for Windows builds.');
  console.log('Please download Python 3.11 embeddable package and install required dependencies.');
}

// Step 4: Build Electron app
console.log('Building Electron app...');
process.chdir(__dirname);
execSync('npm run dist', { stdio: 'inherit' });

console.log('Build complete! Check the dist folder for the Windows installer.');
