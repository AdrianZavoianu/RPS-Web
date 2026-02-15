"""WebSocket consumers for export progress updates."""

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class ExportProgressConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time export progress updates."""

    async def connect(self):
        self.job_id = self.scope["url_route"]["kwargs"]["job_id"]
        self.group_name = f"export_{self.job_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def export_progress(self, event):
        """Handle export progress events from Celery task."""
        await self.send_json(
            {
                "type": "progress",
                "message": event.get("message", ""),
                "current": event.get("current", 0),
                "total": event.get("total", 0),
                "percent": event.get("percent", 0),
            }
        )

    async def export_complete(self, event):
        """Handle export completion events."""
        await self.send_json(
            {
                "type": "complete",
                "status": event.get("status", "success"),
                "message": event.get("message", "Export completed"),
            }
        )

    async def export_error(self, event):
        """Handle export error events."""
        await self.send_json(
            {
                "type": "error",
                "message": event.get("message", "Export failed"),
                "details": event.get("details", ""),
            }
        )
