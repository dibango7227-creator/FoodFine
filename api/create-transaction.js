module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { amount, description, clientName, clientEmail } = req.body;

        if (!amount || amount < 100) {
            return res.status(400).json({ 
                success: false, 
                message: "Le montant minimum pour FedaPay est de 100 XOF." 
            });
        }

        const SECRET_KEY = process.env.FEDAPAY_SECRET_KEY;
        const ENVIRONMENT = process.env.FEDAPAY_ENVIRONMENT || 'sandbox';
        const API_URL = ENVIRONMENT === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';

        if (!SECRET_KEY) {
            throw new Error("FEDAPAY_SECRET_KEY manquante dans les variables Vercel.");
        }

        // 1. Créer la transaction via l'API REST
        const transResponse = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: description || "Paiement Food Fine",
                amount: Math.round(amount),
                currency: { iso: 'XOF' },
                callback_url: req.body.callbackUrl || `https://${req.headers.host}/?payment=success`,
                customer: {
                    firstname: clientName || "Client",
                    lastname: "Food Fine",
                    email: clientEmail || "client@foodfine.com"
                }
            })
        });

        const transData = await transResponse.json();

        if (!transResponse.ok) {
            throw new Error(transData.message || "Erreur lors de la création de la transaction API");
        }

        const transactionId = transData.v1_transaction.id;

        // 2. Générer le token de paiement
        const tokenResponse = await fetch(`${API_URL}/transactions/${transactionId}/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            throw new Error(tokenData.message || "Erreur lors de la génération du token API");
        }

        // Réponse finale compatible avec le frontend
        res.status(200).json({
            success: true,
            transactionId: transactionId,
            token: tokenData.v1_token.token,
            url: tokenData.v1_token.url
        });

    } catch (error) {
        console.error("Erreur API Directe:", error.message);
        res.status(500).json({ 
            success: false, 
            message: "FedaPay API Error: " + error.message
        });
    }
};
