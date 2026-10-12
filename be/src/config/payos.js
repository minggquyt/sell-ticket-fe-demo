const { PayOS } = require('@payos/node');
require('dotenv').config();

let payos = null;

try {
  const clientId = process.env.PAYOS_CLIENT_ID?.trim();
  const apiKey = process.env.PAYOS_API_KEY?.trim();
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY?.trim();

  if (clientId && apiKey && checksumKey) {
    payos = new PayOS({
      clientId,
      apiKey,
      checksumKey,
    });
    // Bridge createPaymentLink cho tương thích với cả 2 phiên bản SDK
    if (!payos.createPaymentLink && payos.paymentRequests) {
      payos.createPaymentLink = async (order) => payos.paymentRequests.create(order);
    }
  } else {
    payos = {
      createPaymentLink: async (order) => ({ checkoutUrl: `https://pay.payos.vn/web/${order?.orderCode || Date.now()}` }),
      paymentRequests: {
        create: async (order) => ({ checkoutUrl: `https://pay.payos.vn/web/${order?.orderCode || Date.now()}` })
      },
      webhooks: { verify: async (data) => data }
    };
  }
} catch (err) {
  payos = {
    createPaymentLink: async (order) => ({ checkoutUrl: `https://pay.payos.vn/web/${order?.orderCode || Date.now()}` }),
    paymentRequests: {
      create: async (order) => ({ checkoutUrl: `https://pay.payos.vn/web/${order?.orderCode || Date.now()}` })
    },
    webhooks: { verify: async (data) => data }
  };
}

module.exports = payos;

