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

        // Extraction sécurisée de l'ID (certaines versions de l'API utilisent 'v1_transaction' ou juste 'transaction')
        const transactionId = transData.v1_transaction ? transData.v1_transaction.id : (transData.transaction ? transData.transaction.id : null);

        if (!transactionId) {
            console.error("Réponse API bizarre:", JSON.stringify(transData));
            throw new Error("Impossible de récupérer l'ID de transaction dans la réponse de FedaPay.");
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

        // Extraction sécurisée du Token et de l'URL
        const finalToken = tokenData.v1_token ? tokenData.v1_token.token : (tokenData.token ? tokenData.token.token : null);
        const finalUrl = tokenData.v1_token ? tokenData.v1_token.url : (tokenData.token ? tokenData.token.url : null);

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
