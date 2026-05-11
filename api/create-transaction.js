const { FedaPay, Transaction } = require('fedapay');

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

        // Configuration FedaPay via Env Vars
        FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY);
        FedaPay.setEnvironment(process.env.FEDAPAY_ENVIRONMENT || 'sandbox');

        // Création de la transaction
        const transaction = await Transaction.create({
            description: description || "Paiement Food Fine",
            amount: Math.round(amount),
            currency: { iso: 'XOF' },
            callback_url: req.body.callbackUrl || `https://${req.headers.host}/?payment=success`,
            customer: {
                firstname: clientName || "Client",
                lastname: "Food Fine",
                email: clientEmail || "client@foodfine.com"
            }
        });

        const token = await transaction.generateToken();

        res.status(200).json({
            success: true,
            transactionId: transaction.id,
            token: token.token,
            url: token.url
        });
    } catch (error) {
        console.error("Erreur FedaPay:", error.message);
        res.status(500).json({ 
            success: false, 
            message: "Erreur lors de la création de la transaction FedaPay.",
            error: error.message 
        });
    }
};
