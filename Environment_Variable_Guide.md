# Environment Variable Setup Guide for Render

This guide provides detailed instructions on how to obtain and configure the necessary environment variables for the **AI YouTube Clip Creator** application on Render.

## Where to Set Environment Variables in Render

1.  Navigate to your service (e.g., `clips-ai`) in the [Render Dashboard](https://dashboard.render.com/).
2.  Click on the **Environment** tab on the left sidebar.
3.  Here, you will use the **"Add Environment Variable"** button for most keys and the **"Add Secret File"** button for your Google Cloud credentials file.

![Render Environment Tab](https://i.imgur.com/H0a2i69.png)

---

## Variable-by-Variable Guide

Here is a breakdown of each required variable, what it's for, and where to find it.

### 1. `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`

*   **Purpose**: These keys are used for the "Log in with Google" feature (OAuth 2.0). They allow your application to securely request access to a user's basic profile information and YouTube data on their behalf.
*   **Where to get them**:
    1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
    2.  Navigate to **APIs & Services > Credentials**.
    3.  Click **+ CREATE CREDENTIALS** and select **OAuth client ID**.
    4.  Set the **Application type** to **Web application**.
    5.  Under **Authorized redirect URIs**, add the callback URL for your Render service. It follows this format: `https://<your-service-name>.onrender.com/api/v1/auth/google/callback`.
        *   *Example*: `https://clips-ai.onrender.com/api/v1/auth/google/callback`
    6.  Click **Create**. A window will pop up showing your `Client ID` and `Client Secret`.
*   **Render Setup**:
    *   Add `GOOGLE_CLIENT_ID` as an environment variable with its value.
    *   Add `GOOGLE_CLIENT_SECRET` as an environment variable with its value.

### 2. `GOOGLE_API_KEY`

*   **Purpose**: This key is used for accessing public Google APIs that do not require user authentication, such as the YouTube Data API v3 (for fetching public video details).
*   **Where to get it**:
    1.  In the [Google Cloud Console](https://console.cloud.google.com/), go to **APIs & Services > Credentials**.
    2.  Click **+ CREATE CREDENTIALS** and select **API key**.
    3.  A new key will be generated. It is **highly recommended** to restrict this key for security:
        *   Click **Edit API key**.
        *   Under **Application restrictions**, select **HTTP referrers (web sites)** and add your Render application's URL (e.g., `clips-ai.onrender.com/*`).
        *   Under **API restrictions**, select **Restrict key** and choose the **YouTube Data API v3** and any other public APIs you use (like Generative Language API).
*   **Render Setup**:
    *   Add `GOOGLE_API_KEY` as an environment variable with its value.

### 3. `google-credentials.json` (as a Secret File)

*   **Purpose**: This file contains the credentials for a **Service Account**. Your backend server uses it to authenticate itself to Google Cloud services like Speech-to-Text, Cloud Storage, and the Natural Language API without needing a human user.
*   **Where to get it**:
    1.  In the [Google Cloud Console](https://console.cloud.google.com/), go to **IAM & Admin > Service Accounts**.
    2.  Select an existing service account or create a new one.
    3.  Ensure the service account has the necessary roles (e.g., `Storage Admin`, `Cloud Speech-to-Text Admin`, `Cloud Natural Language AI User`). You can add these roles in the **IAM** page.
    4.  Click on the service account's email address.
    5.  Go to the **KEYS** tab.
    6.  Click **ADD KEY > Create new key**.
    7.  Choose **JSON** as the key type and click **Create**. A `.json` file will be downloaded to your computer.
*   **Render Setup**:
    1.  Open the downloaded `.json` file with a text editor.
    2.  Copy the **entire content** of the file.
    3.  In Render's **Environment** tab, click **Add Secret File**.
    4.  For the **Filename**, enter `google-credentials.json`.
    5.  In the **Contents** box, paste the JSON content you copied.
    6.  Click **Save Changes**.

### 4. `BUCKET_NAME`

*   **Purpose**: This is the name of the Google Cloud Storage (GCS) bucket where your application will temporarily upload audio files for analysis.
*   **Where to get it**:
    1.  In the [Google Cloud Console](https://console.cloud.google.com/), navigate to **Cloud Storage > Buckets**.
    2.  Find the bucket you created for this application (e.g., `clipersworkstrage`). The name listed here is the value you need.
*   **Render Setup**:
    *   Add `BUCKET_NAME` as an environment variable with your bucket's name.

### 5. `JWT_SECRET`

*   **Purpose**: This is a secret key that you create. It's used to sign JSON Web Tokens (JWTs) for your application's own user authentication system (e.g., email/password login), ensuring that the tokens are authentic and have not been tampered with.
*   **How to create it**:
    *   This should be a long, random, and completely secret string. Do not use a simple or guessable password.
    *   You can use a password generator or a command-line tool to create a strong secret. For example, on your local machine, you can run:
        ```bash
        openssl rand -hex 32
        ```
    *   This will output a random 64-character string that you can use.
*   **Render Setup**:
    *   Add `JWT_SECRET` as an environment variable and paste the secret string you generated.

---

After setting all these variables, remember to **manually deploy** your service one more time from the Render dashboard to ensure all the new environment variables are loaded and used by your application.
