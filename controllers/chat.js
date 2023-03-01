/**
 * @param  {import("fastify").FastifyRequest} request
 * @param  {import("fastify").FastifyReply} reply
 */
export async function handleChatRoom(request, reply) {
  const { roomId } = request.params;
  return {
    data: {
      roomId,
      message: "Hello World!",
    },
    error: null,
  };
}
