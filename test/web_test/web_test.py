import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options


class TestNexent():
    @classmethod
    def setup_class(cls):
        options = Options()
        options.add_argument('--headless')
        cls.driver = webdriver.Firefox(options=options)
        cls.wait = WebDriverWait(cls.driver, 20)
        cls.vars = {}

    @classmethod
    def teardown_class(cls):
        cls.driver.quit()

    def test_login(self):
        self.driver.get("http://120.26.61.157:3000/zh")
        # 等待并点击用户图标
        user_icon = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".anticon-user > svg")))
        user_icon.click()
        # 等待并点击登录菜单
        login_menu = self.wait.until(EC.element_to_be_clickable((By.XPATH, "//li[3]/span[2]")))
        login_menu.click()
        # 等待邮箱输入框可见并输入
        email_input = self.wait.until(EC.visibility_of_element_located((By.XPATH, "(//input[@id='email'])[2]")))
        email_input.click()
        email_input.send_keys("test@qq.com")
        # 等待并点击密码输入框前的区域（如有）
        self.wait.until(EC.element_to_be_clickable((By.XPATH, "//div[4]/div[2]/div/div/div"))).click()
        # 等待密码输入框可见并输入
        pwd_input = self.wait.until(EC.visibility_of_element_located((By.XPATH, "(//input[@id='password'])[2]")))
        pwd_input.click()
        pwd_input.send_keys("000000")
        # 等待并点击登录按钮
        login_btn = self.wait.until(EC.element_to_be_clickable((By.XPATH, "/html/body/div[4]/div[2]/div/div[1]/div/div[2]/form/div[3]/div/div/div/div/button")))
        login_btn.click()

        # 检查登录是否成功
        try:
            success_elem = self.wait.until(EC.visibility_of_element_located((By.XPATH, "/html/body/div[1]/header/div[2]/span[1]")))
            assert success_elem is not None, "登录失败：未找到登录成功邮箱标识"
        except Exception as e:
            assert False, f"登录失败：{str(e)}"

    def test_chat(self):
        # 等待遮挡元素消失
        self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, ".ant-modal-wrap")))
        # 再等按钮可点击
        start_btn = self.wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(.,'开始问答')]")))
        start_btn.click()

        # 等待 textarea 可见
        textarea = self.wait.until(EC.visibility_of_element_located((By.XPATH, "//textarea")))
        textarea.send_keys("北京今天天气怎么样？")

        # 等待发送按钮可点击
        send_btn = self.wait.until(EC.element_to_be_clickable((By.XPATH, "//button[3]")))
        send_btn.click()

        # 等待输出内容流式生成完成
        time.sleep(40)
        output_xpath = "/html/body/div[2]/div[1]/div[2]/div/div[1]/div[1]/div[1]/div/div"
        elem = self.driver.find_element(By.XPATH, output_xpath)
        output_text = elem.text
        assert 'error' not in output_text.lower(), f"测试失败：输出内容包含error，实际内容为：{output_text}"
