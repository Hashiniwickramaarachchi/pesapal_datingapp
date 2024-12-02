const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();
const { db } = require('./firebase');
const { addDoc, collection } = require('firebase/firestore');

app.use(bodyParser.json());

const APP_ENVIRONMENT = 'sandbox'; 

// Helper function to get Access Token
const getAccessToken = async () => {
  try {
    const apiUrl = APP_ENVIRONMENT === 'sandbox'
      ? 'https://cybqa.pesapal.com/pesapalv3/api/Auth/RequestToken'
      : 'https://pay.pesapal.com/v3/api/Auth/RequestToken';

    const response = await axios.post(apiUrl, {
      consumer_key: 'qkio1BGGYAXTu2JOfm7XSXNruoZsrqEW',
      consumer_secret: 'osGQ364R49cXKeOYSpaOnT++rHs='
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    return response.data.token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
};

// Helper function to register IPN
const registerIPN = async (token) => {
  try {
    const ipnRegistrationUrl = APP_ENVIRONMENT === 'sandbox'
      ? 'https://cybqa.pesapal.com/pesapalv3/api/URLSetup/RegisterIPN'
      : 'https://pay.pesapal.com/v3/api/URLSetup/RegisterIPN';

    const response = await axios.post(ipnRegistrationUrl, {
      url: 'https://1f5dccdf-6580-4ed7-b135-89e5b7a31fdd.mock.pstmn.io/pin',
      ipn_notification_type: 'POST'
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data.ipn_id;
  } catch (error) {
    console.error('Error registering IPN:', error);
    throw error;
  }
};

// Helper function to submit order
const submitOrderRequest = async (token, orderDetails) => {
  try {
    const submitOrderUrl = APP_ENVIRONMENT === 'sandbox'
      ? 'https://cybqa.pesapal.com/pesapalv3/api/Transactions/SubmitOrderRequest'
      : 'https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest';

    const response = await axios.post(submitOrderUrl, orderDetails, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error submitting order:', error);
    throw error;
  }
};

// Save payment data to Firestore
const savePaymentData = async (paymentData) => {
  try {
    const docRef = await addDoc(collection(db, 'payments'), paymentData);
    console.log('Payment data saved successfully with ID:', docRef.id);
    return docRef.id; 
  } catch (error) {
    console.error('Error saving payment data:', error);
    throw error;
  }
};

// API to handle the full process
app.post('/submit-order', async (req, res) => {
  try {
    const { amount, phone, first_name, middle_name, last_name, email_address, description, branch, callback_url } = req.body;

    // Step 1: Get access token
    const token = await getAccessToken();

    // Step 2: Register IPN
    const ipn_id = await registerIPN(token);

    // Step 3: Submit order
    const merchant_reference = Math.floor(Math.random() * 1000000000000000000);
    const orderDetails = {
      id: merchant_reference.toString(),
      currency: 'UGX',
      amount,
      description,
      callback_url,
      notification_id: ipn_id,
      branch,
      billing_address: {
        email_address,
        phone_number: phone,
        country_code: 'UG',
        first_name,
        middle_name,
        last_name
      }
    };

    const orderResponse = await submitOrderRequest(token, orderDetails);

    // Save payment data to Firestore
    const paymentData = {
      order_tracking_id: orderResponse.order_tracking_id || null,
      merchant_reference: orderResponse.merchant_reference || null,
      amount,
      phone,
      first_name,
      middle_name,
      last_name,
      email_address,
      created_at: new Date().toISOString()
    };

    await savePaymentData(paymentData);

    // Send response to the client
    res.json(orderResponse);
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ error: 'An error occurred while processing the order.' });
  }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
