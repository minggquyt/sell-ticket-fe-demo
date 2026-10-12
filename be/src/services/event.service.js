const ticketService = require('./ticket.service');

/**
 * Event Service (đồng bộ dữ liệu sự kiện từ Supabase / Postgres)
 */
module.exports = {
  getAllEvents: ticketService.getAllEvents,
  getEventById: ticketService.getEventById,
  getSeatsByEvent: ticketService.getSeatsByEvent,
  getZonesByEvent: ticketService.getZonesByEvent,
  createEventWithConfig: ticketService.createEventWithConfig,
  deleteEvent: ticketService.deleteEvent,
  getAllTicketsForAdmin: ticketService.getAllTicketsForAdmin
};
