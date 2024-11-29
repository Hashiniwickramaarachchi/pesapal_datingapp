require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { addDoc, collection } = require('firebase/firestore');
const { db } = require('./firebase'); 
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); 

// Helper function to make a POST request
const makePostRequest = async (url, data, headers) => {
    try {
        const response = await axios.post(url, data, { headers });
        return response.data;
    } catch (error) {
        console.error("Error in POST request:", error.response?.data || error.message);
        return null;
    }
};

// Helper function to save payment data to Firestore
const savePaymentData = async (paymentData) => {
    try {
        if (paymentData && paymentData.email && paymentData.status && paymentData.order_id) {
            const docRef = await addDoc(collection(db, "payments"), paymentData);
            console.log("Document written with ID: ", docRef.id);
        } else {
            console.error("Missing required fields for saving payment data:", paymentData);
        }
    } catch (e) {
        console.error("Error adding document: ", e);
    }
};

// Endpoint to start the payment process
app.post('/process-payment', async (req, res) => {
    const { orderData, ipnData } = req.body; 

    if (!orderData || !ipnData) {
        return res.status(400).json({ message: 'Missing required payment data.' });
    }

    const authData = {
        consumer_key: process.env.PESAPAL_CONSUMER_KEY,
        consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
    };
    const authHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        // 1. Send the auth request to get the token
        const authResponse = await makePostRequest(
            'https://cybqa.pesapal.com/pesapalv3/api/Auth/RequestToken',
            authData,
            authHeaders
        );

        if (authResponse && authResponse.token) {
            const token = authResponse.token;

            // 2. Register IPN
            const ipnHeaders = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
            };

            await makePostRequest(
                'https://cybqa.pesapal.com/pesapalv3/api/URLSetup/RegisterIPN',
                ipnData,
                ipnHeaders
            );

            // 3. Submit the order
            const orderHeaders = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            };

            const orderResponse = await makePostRequest(
                'https://cybqa.pesapal.com/pesapalv3/api/Transactions/SubmitOrderRequest',
                orderData,
                orderHeaders
            );

            if (orderResponse && orderResponse.order_tracking_id && orderResponse.merchant_reference) {
                const paymentData = {
                    email: orderData.billing_address.email_address || "No email provided",
                    status: orderResponse.status || "Unknown",
                    amount: orderData.amount || 0,
                    order_id: orderData.id || "Unknown",
                    tracking_id: orderResponse.order_tracking_id || "Unknown",
                    merchant_reference: orderResponse.merchant_reference || "Unknown",
                };

                // 4. Save payment data to Firestore
                await savePaymentData(paymentData);

                // 5. Extract the payment URL from the response (usually found in the order response)
                const paymentUrl = orderResponse.payment_url || "No payment URL provided";

                // Respond to the mobile app with the payment URL
                res.status(200).json({
                    message: 'Payment processed successfully',
                    paymentUrl: paymentUrl,
                    paymentData: paymentData,
                });
            } else {
                res.status(500).json({ message: 'Failed to submit order', details: orderResponse });
            }
        } else {
            res.status(500).json({ message: 'Failed to authenticate with Pesapal' });
        }
    } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});  
