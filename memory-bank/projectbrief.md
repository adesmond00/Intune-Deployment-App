# Project Brief: Intune Deployment Toolkit

## Goal
Create an Intune Deployment Toolkit to simplify the process of packaging and deploying Win32 applications to Microsoft Intune.

## Purpose
The primary purpose of this toolkit is to streamline and automate the often complex and manual steps involved in preparing traditional Windows applications (like `.exe` or `.msi` installers) for deployment via Intune's Win32 app model. It aims to reduce errors and save time for IT administrators.

## Core Components
The toolkit consists of three main parts:

1.  **Frontend**: A web-based user interface built with React, TypeScript, Vite, and TailwindCSS. This is the primary interaction point for the user. (Located in `Front-end/`)
2.  **Backend API**: A Python FastAPI application that serves as the intermediary between the frontend and the core scripting logic. (Located in `api/`)
3.  **Core Logic**: A collection of PowerShell scripts responsible for handling the interactions with Intune, packaging applications (`.intunewin` format), and potentially leveraging tools like `winget`. (Located in `scripts/`)
