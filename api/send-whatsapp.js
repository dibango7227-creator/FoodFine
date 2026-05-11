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
        const { orderType, clientName, amount, items, delivery, address, resDetails } = req.body;
        
        let message = `*✅ NOUVELLE COMMANDE FOOD FINE !*\n\n`;
        message += `*Client :* ${clientName}\n`;
        message += `*Statut :* 🟢 Payé (FedaPay)\n`;
        message += `*Total Payé :* ${amount} F\n\n`;
        
        if (orderType === 'cart') {
            message += `*🛒 DÉTAILS DU PANIER :*\n`;
            if (items && items.length > 0) {
                items.forEach(item => {
                    message += `- ${item.name} (${item.price} F)\n`;
                });
            }
            if (delivery && address) {
                message += `\n*📍 Adresse :* ${address}\n`;
            }
        } else if (orderType === 'reservation') {
            message += `*🍽️ RÉSERVATION DE TABLE :*\n`;
            message += `- *Code :* ${resDetails?.code || 'N/A'}\n`;
            message += `- *Table :* ${resDetails?.table || 'N/A'}\n`;
            message += `- *Zone :* ${resDetails?.area || 'N/A'}\n`;
        }

        const idInstance = process.env.GREEN_API_ID;
        const apiTokenInstance = process.env.GREEN_API_TOKEN;
        const phone = process.env.RESTAURANT_WA_NUMBER;
        
        if (!idInstance || !apiTokenInstance || !phone) {
            throw new Error("Configuration Green API manquante");
        }

        const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
        const payload = {
            chatId: `${phone}@c.us`,
            message: message
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Erreur WhatsApp:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
