import os

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


APP_BASE_URL = os.getenv("APP_BASE_URL")
SELENIUM_REMOTE_URL = os.getenv("SELENIUM_REMOTE_URL")


pytestmark = pytest.mark.skipif(
    not APP_BASE_URL or not SELENIUM_REMOTE_URL,
    reason="Selenium environment is not configured",
)


@pytest.fixture
def driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    browser = webdriver.Remote(command_executor=SELENIUM_REMOTE_URL, options=options)
    try:
        yield browser
    finally:
        browser.quit()


def test_login_screen_loads(driver):
    driver.get(f"{APP_BASE_URL}/login")

    WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, "login-btn")))

    assert "InterviewAI" in driver.title
    assert driver.find_element(By.ID, "email").get_attribute("type") == "email"
    assert driver.find_element(By.ID, "password").get_attribute("type") == "password"
