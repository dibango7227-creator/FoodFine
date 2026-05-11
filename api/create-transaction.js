module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { amount, description, clientName, clientEmail } = req.body;
        const SECRET_KEY = process.env.FEDAPAY_SECRET_KEY;
        
        if (!SECRET_KEY) {
            throw new Error("La clé FEDAPAY_SECRET_KEY n'est pas configurée dans Vercel.");
        }

        // Détection automatique de l'URL API
        const isLive = SECRET_KEY.trim().startsWith('sk_live');
        const API_URL = isLive ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';

        console.log(`Tentative de paiement : ${amount} XOF en mode ${isLive ? 'LIVE' : 'SANDBOX'}`);

        // 1. Création de la transaction
        const transResponse = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SECRET_KEY.trim()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                description: description || "Commande Food Fine",
                amount: Math.round(amount),
                currency: { iso: 'XOF' },
                callback_url: req.body.callbackUrl || `https://${req.headers.host}/?payment=success`,
                customer: {
                    firstname: clientName || "Client",
                    lastname: "Food Fine",
                    email: (clientEmail && clientEmail.includes('@')) ? clientEmail : "client@foodfine.com"
                }
            })
        });

        const transData = await transResponse.json();

        if (!transResponse.ok) {
            throw new Error(transData.message || "Erreur FedaPay lors de la création");
        }

        // Extraction ultra-robuste de l'ID
        let transactionId = null;
        if (transData.v1_transaction) transactionId = transData.v1_transaction.id;
        else if (transData['v1/transaction']) transactionId = transData['v1/transaction'].id;
        else if (transData.transaction) transactionId = transData.transaction.id;
        else if (transData.id) transactionId = transData.id; // Cas où l'objet est retourné directement

        if (!transactionId) {
            const keys = Object.keys(transData).join(', ');
            console.error("Structure inconnue. Clés reçues:", keys);
            throw new Error(`Structure de réponse FedaPay inconnue (Clés: ${keys}). Veuillez contacter le support.`);
        }

        // 2. Génération du Token de paiement
        const tokenResponse = await fetch(`${API_URL}/transactions/${transactionId}/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SECRET_KEY.trim()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            throw new Error(tokenData.message || "Erreur FedaPay lors de la génération du token");
        }

        // Extraction ultra-robuste du Token et de l'URL
        let finalToken = null;
        let finalUrl = null;

        if (tokenData.v1_token) {
            finalToken = tokenData.v1_token.token;
            finalUrl = tokenData.v1_token.url;
        } else if (tokenData['v1/token']) {
            finalToken = tokenData['v1/token'].token;
            finalUrl = tokenData['v1/token'].url;
        } else if (tokenData.token) {
            finalToken = typeof tokenData.token === 'string' ? tokenData.token : tokenData.token.token;
            finalUrl = tokenData.token.url || tokenData.url;
        } else {
            finalToken = tokenData.token;
            finalUrl = tokenData.url;
        }

        if (!finalUrl) {
            throw new Error("Lien de paiement non généré par FedaPay.");
        }

        res.status(200).json({
            success: true,
            token: finalToken,
            url: finalUrl
        });

    } catch (error) {
        console.error("ERREUR CRITIQUE:", error.message);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};
