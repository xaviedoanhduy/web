import odoo.tests
from odoo.tests import HttpCase, tagged


@tagged("-at_install", "post_install")
class TestHoot(HttpCase):
    @odoo.tests.no_retry
    def test_suite(self):
        self.browser_js(
            "/web/tests?suite=ad791ca3",
            "console.log('test successful')",
            login="admin",
        )
