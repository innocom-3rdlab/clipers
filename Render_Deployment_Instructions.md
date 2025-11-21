# Render Deployment Instructions for clips-ai

Based on the information you provided, it appears you already have a service set up on Render with the ID `srv-d47gjr9r0fns73fel8i0`, linked to the `Kanta02cer/clips` repository and targeting the `feature/initial-setup` branch.

Here are the steps to ensure your application is properly reflected on Render, along with important notes on configuration and cost management:

## 1. Confirming Your Render Service Setup

1.  **Access Render Dashboard**: Log in to your [Render dashboard](https://dashboard.render.com/).
2.  **Locate Service**: Navigate to the service with ID `srv-d47gjr9r0fns73fel8i0`.
3.  **Verify Repository & Branch**:
    *   Ensure that this service is connected to your GitHub repository `Kanta02cer/clips`.
    *   Confirm that the deployment branch is set to `feature/initial-setup`.

## 2. Configuring Deployment Settings

Your project contains a `Dockerfile` at the root, which indicates a Docker-based deployment. Render will automatically detect this `Dockerfile` and attempt to build and deploy your application using Docker. This overrides any `env: node` setting in a `render.yaml` for a direct Node.js deploy.

**Recommendation**: For the most seamless experience with `render.yaml`, consider using Render's "Blueprint" feature. If your service was set up manually, you might want to recreate it as a Blueprint service to leverage the `render.yaml` configuration fully.

### Essential Environment Variables Configuration

Even with a `Dockerfile`, you **must** configure the following environment variables in your Render service dashboard. These are crucial for your application's functionality and security:

1.  **Navigate to Environment Settings**: In your Render service dashboard, go to the **Environment** tab.
2.  **Add Environment Variables**: Add each of the following keys and their corresponding values. For sensitive information like credentials, it is highly recommended to use Render's "Secret File" feature or "Environment Variable" securely.

    *   `GOOGLE_API_KEY`: Your Google Cloud API Key.
    *   `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
    *   `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret.
    *   `JWT_SECRET`: A secure, random string for JSON Web Token signing.
    *   `BUCKET_NAME`: The name of your Google Cloud Storage bucket (e.g., `clipersworkstrage`).
    *   `google-credentials.json`: **Crucially, upload this as a Secret File.** This is your Google Cloud service account key file. Render will make it available to your application at runtime.

## 3. Triggering the Deployment

Once all environment variables are correctly set:

1.  **Go to Events/Deploys**: In your Render service dashboard, navigate to the "Events" or "Deploys" section.
2.  **Manual Deploy**: Click on the "Manual Deploy" button and select the `feature/initial-setup` branch to initiate a new deployment.

Render will then pull the latest code from your GitHub repository, build the Docker image, and deploy your application. You can monitor the build and deploy logs directly in the Render dashboard.

## 4. Cost Management and Visibility

Your service is currently on the `Free` plan.

-   **Upgrade Your Instance**: If your application requires more resources (e.g., higher CPU, more RAM), you can upgrade your instance plan in the "Settings" tab of your service. This will affect your monthly cost.
-   **Cost Monitoring**: Render provides detailed billing information in your account dashboard. You can view your current usage, past invoices, and estimated costs in the **Billing** section.
-   **Setting Limits**: While Render doesn't have a direct "maximum spend" feature for individual services, you can manage costs by:
    *   Choosing fixed-price plans.
    *   If using auto-scaling (available on paid plans), setting a maximum number of instances to cap potential expenditure.

By following these steps, your `clips-ai` application should be successfully deployed and running on Render!