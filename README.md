# AI YouTube Clip Creator

AI YouTube Clip Creator is a web application that automatically generates short video clips from a YouTube video URL. It analyzes the video's audio, identifies highlights, and creates shareable clips with features like automatically generated titles and captions.

## ✨ Key Features

-   **Automatic Clip Generation**: Creates short video clips from a YouTube URL.
-   **AI-Powered Analysis**: Utilizes Google Cloud's Speech-to-Text and Natural Language APIs to analyze audio and find exciting moments.
-   **Smart Title Generation**: Employs the Gemini 1.5 Flash model to generate catchy titles for the clips.
-   **Customizable Output**: Allows users to specify keywords, clip duration, and other settings.
-   **Easy Deployment**: Can be deployed to Render with a single configuration file.

## 🛠️ Tech Stack

-   **Backend**: Node.js, Express.js
-   **Frontend**: Vanilla JavaScript, HTML5, CSS3
-   **APIs & Services**:
    -   Google Cloud Speech-to-Text
    -   Google Cloud Natural Language
    -   Google Generative Language (Gemini)
    -   yt-dlp-wrap for video downloading
    -   ffmpeg for video processing

## 🚀 Getting Started (Local Development)

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later recommended)
-   `npm` (comes with Node.js)
-   Access to Google Cloud Platform with the necessary APIs enabled (Speech-to-Text, Natural Language, Generative Language).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/innocom-3rdlab/clipers.git
    cd clipers
    ```

2.  **Install server dependencies:**
    The backend server contains all the core logic.
    ```bash
    cd server
    npm install
    ```

3.  **Set up environment variables:**
    The server requires several API keys and configuration settings. Create a `.env` file in the `server/` directory and add the following variables. You can copy the example file:
    
    ```bash
    cp .env.example .env
    ```

    Then, fill in the values in your `.env` file:
    ```
    # Google Cloud API Key (for YouTube Data API, Gemini, etc.)
    GOOGLE_API_KEY="AIza..."

    # Google OAuth Credentials (for accessing private YouTube videos)
    # Get these from the Google Cloud Console
    GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
    GOOGLE_CLIENT_SECRET="GOCSPX..."

    # Base URL of your application (for local development)
    APP_BASE_URL="http://localhost:3000"

    # Secret for signing JWT tokens (choose a long, random string)
    JWT_SECRET="your-super-secret-key"

    # Google Cloud Storage Bucket Name
    BUCKET_NAME="your-gcs-bucket-name"
    ```
    **Note:** For the application to work correctly, you also need a `google-credentials.json` file in the `server/` directory. This is the service account key file for your Google Cloud project.

4.  **Start the server:**
    Once the dependencies are installed and environment variables are set, you can start the server from the `server/` directory:
    ```bash
    npm start
    ```
    The application should now be running at `http://localhost:3000`.

## ☁️ Deployment to Render

This project is configured for easy deployment to [Render](https://render.com/) using a Blueprint.

### Steps

1.  **Push your code to your GitHub repository.**
    The repository already includes a `render.yaml` file that defines the service.

2.  **Create a new "Blueprint" service in the Render Dashboard.**
    -   Connect your GitHub account to Render.
    -   Select your repository. Render will automatically detect and use the `render.yaml` file.

3.  **Configure Environment Variables.**
    The `render.yaml` file is configured to read sensitive information (like API keys) from environment variables. You **must** set these in the Render dashboard for your service:
    -   Go to your service's **Environment** tab.
    -   Add the following variables, using the "Secret File" type for the `google-credentials.json` content and "Environment Variable" for the others:
        -   `GOOGLE_API_KEY`
        -   `GOOGLE_CLIENT_ID`
        -   `GOOGLE_CLIENT_SECRET`
        -   `JWT_SECRET`
        -   `BUCKET_NAME`
        -   `google-credentials.json` (as a Secret File)

    Render will automatically trigger a new deployment when you push changes to your repository.

### Cost Management on Render

-   **Service Plan**: The `render.yaml` is set to the `free` plan by default, which is a great starting point. If you need more resources, you can upgrade the plan in the "Settings" tab of your service.
-   **Cost Monitoring**: You can monitor your current usage and costs in the **Billing** section of your Render account dashboard.
-   **Setting Limits**: While Render doesn't have a hard "maximum cost" setting, you can control costs by:
    -   Choosing a fixed-price service plan.
    -   If using auto-scaling (on paid plans), setting a maximum number of instances to prevent unexpected cost increases.