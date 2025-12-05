# Integration Guide: High Furries Verification Snippet

 This guide explains how to add the Certificate Verification search box to any external website (e.g., WordPress, Wix, Squarespace, or a custom site).

 ## 1. Whitelist Your Website
 **CRITICAL STEP**: The verification widget will NOT work unless you authorize your website's domain in the backend.

 1.  Log in to your **Render Dashboard**.
 2.  Go to your **Backend Service** > **Environment**.
 3.  Add a new Environment Variable:
     *   **Key**: `ALLOWED_ORIGINS`
     *   **Value**: Your website URL (e.g., `https://www.myschool.com`).
     *   *Note*: If you have multiple websites, separate them with commas (e.g., `https://site1.com,https://site2.com`).
 4.  **Save Changes**. Render will restart your server.

 ## 2. Embed the Snippet
 Copy and paste the following code into your website's HTML where you want the search box to appear.

 ```html
 <!-- START: High Furries Verification Widget -->
 <div id="hf-verification-app" style="width: 100%; max-width: 600px; margin: 0 auto; font-family: sans-serif;">
     <div id="hf-search-box" style="text-align: center;">
         <h3>Verify Certificate</h3>
         <div style="display: flex; gap: 10px; justify-content: center;">
             <input type="text" id="hf-cert-input" placeholder="Certificate ID (e.g., HF-2024-1234)" 
                 style="padding: 10px; width: 70%; border: 1px solid #ccc; border-radius: 4px;">
             <button onclick="hfVerifyCert()" 
                 style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                 Verify
             </button>
         </div>
     </div>
 
     <!-- Results Container -->
     <div id="hf-result-card" style="display: none; margin-top: 20px; border: 1px solid #eee; padding: 20px; border-radius: 8px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
         <div id="hf-status-message" style="font-weight: bold; font-size: 18px; margin-bottom: 10px;"></div>
         <div id="hf-cert-details" style="display: none;">
             <p><strong>Name:</strong> <span id="hf-name"></span></p>
             <p><strong>Course:</strong> <span id="hf-course"></span></p>
             <p><strong>Date:</strong> <span id="hf-date"></span></p>
             <!-- Secure Email Button -->
            <button onclick="hfEmailCert()" style="margin-top: 15px; background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">📧 Email Me a Copy</button>
            <div id="hf-email-result" style="font-size: 12px; margin-top: 5px;"></div>
         </div>
     </div>
 </div>
 
 <script>
 (function() {
     // CONFIGURATION
     // Ensure this matches your deployed backend URL
     const API_BASE = "https://certificate-verification-woce.onrender.com/api/public/verify/";
 
     window.hfVerifyCert = async function() {
         const input = document.getElementById('hf-cert-input');
         const resultCard = document.getElementById('hf-result-card');
         const statusMsg = document.getElementById('hf-status-message');
         const details = document.getElementById('hf-cert-details');
         const id = input.value.trim();
 
         if (!id) return;
 
         // Reset UI
         resultCard.style.display = 'block';
         statusMsg.innerText = "Verifying...";
         statusMsg.style.color = "#666";
         details.style.display = 'none';
 
         try {
             const response = await fetch(API_BASE + id);
             const data = await response.json();
 
             if (data.valid) {
                 statusMsg.innerHTML = "✅ Verified Authentic";
                 statusMsg.style.color = "#28a745";
                 document.getElementById('hf-name').innerText = data.candidateName;
                 document.getElementById('hf-course').innerText = data.position;
                 document.getElementById('hf-date').innerText = data.issueDate;
                 // document.getElementById('hf-download').href = data.cloudinaryUrl; // Removed
                 details.style.display = 'block';
             } else {
                 throw new Error(data.message || "Invalid Certificate");
             }
         } catch (error) {
             statusMsg.innerHTML = "❌ Verification Failed";
             statusMsg.style.color = "#dc3545";
             details.style.display = 'none';
         }
             details.style.display = 'none';
        }
    };

    window.hfEmailCert = async function() {
        const id = document.getElementById('hf-cert-input').value.trim();
        const resDiv = document.getElementById('hf-email-result');
        if(!id) return;
        resDiv.innerHTML = "Sending...";
        try {
           const res = await fetch(API_BASE.replace('verify/','resend-email/') + id, {method:'POST'});
           const data = await res.json();
           resDiv.innerHTML = data.success ? "✅ " + data.message : "❌ " + data.message;
           resDiv.style.color = data.success ? "green" : "red";
        } catch(e) { resDiv.innerHTML = "❌ Connection Error"; }
    };
 })();
 </script>
 <!-- END: High Furries Verification Widget -->
 ```

 ## Troubleshooting
 - **"Verification Failed" even for valid IDs?**
   - Check the Browser Console (F12). If you see a **CORS error**, it means you forgot to add your website to the `ALLOWED_ORIGINS` in the backend settings.
