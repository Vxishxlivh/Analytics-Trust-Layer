import requests
import sys
import json
import io
from datetime import datetime

class TrustLayerAPITester:
    def __init__(self, base_url="https://trustlayer-validate.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=headers)
                else:
                    headers['Content-Type'] = 'application/json'
                    response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Non-dict response'}")
                    return True, response_data
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "",
            200
        )
        if success and isinstance(response, dict):
            expected_message = "TrustLayer API"
            if response.get('message') == expected_message:
                print(f"   ✅ Correct message: {response.get('message')}")
                return True
            else:
                print(f"   ❌ Wrong message. Expected: '{expected_message}', Got: '{response.get('message')}'")
        return False

    def test_csv_upload(self):
        """Test CSV file upload"""
        # Create a sample CSV file
        csv_content = """month,revenue,customers,churn_rate
Jan,142000,720,3.2
Feb,148000,735,3.1
Mar,155000,750,2.9"""
        
        files = {'file': ('test.csv', csv_content, 'text/csv')}
        
        success, response = self.run_test(
            "CSV File Upload",
            "POST",
            "upload-csv",
            200,
            files=files
        )
        
        if success and isinstance(response, dict):
            required_keys = ['columns', 'preview_rows', 'all_rows', 'total_rows']
            missing_keys = [key for key in required_keys if key not in response]
            if not missing_keys:
                print(f"   ✅ All required keys present: {required_keys}")
                print(f"   ✅ Total rows: {response.get('total_rows')}")
                print(f"   ✅ Columns: {response.get('columns')}")
                return True, response
            else:
                print(f"   ❌ Missing keys: {missing_keys}")
        return False, {}

    def test_csv_text_parsing(self):
        """Test CSV text parsing"""
        csv_text = """month,revenue,customers,churn_rate
Jan,142000,720,3.2
Feb,148000,735,3.1
Mar,155000,750,2.9"""
        
        success, response = self.run_test(
            "CSV Text Parsing",
            "POST",
            "parse-csv-text",
            200,
            data={"csv_text": csv_text}
        )
        
        if success and isinstance(response, dict):
            required_keys = ['columns', 'preview_rows', 'all_rows', 'total_rows']
            missing_keys = [key for key in required_keys if key not in response]
            if not missing_keys:
                print(f"   ✅ All required keys present: {required_keys}")
                print(f"   ✅ Total rows: {response.get('total_rows')}")
                print(f"   ✅ Columns: {response.get('columns')}")
                return True, response
            else:
                print(f"   ❌ Missing keys: {missing_keys}")
        return False, {}

    def test_excel_upload(self):
        """Test Excel file upload (simulated)"""
        # Create a simple CSV that we'll pretend is Excel
        csv_content = """month,revenue,customers
Jan,142000,720
Feb,148000,735"""
        
        files = {'file': ('test.xlsx', csv_content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        success, response = self.run_test(
            "Excel File Upload (simulated)",
            "POST",
            "upload-csv",
            200,
            files=files
        )
        
        return success, response

    def test_invalid_csv(self):
        """Test invalid CSV handling"""
        invalid_csv = "invalid,csv,data\nwith,missing\ncolumns"
        
        success, response = self.run_test(
            "Invalid CSV Handling",
            "POST",
            "parse-csv-text",
            400,  # Expecting error
            data={"csv_text": invalid_csv}
        )
        
        return success, response

    def test_empty_file_upload(self):
        """Test empty file upload"""
        files = {'file': ('empty.csv', '', 'text/csv')}
        
        success, response = self.run_test(
            "Empty File Upload",
            "POST",
            "upload-csv",
            400,  # Expecting error
            files=files
        )
        
        return success, response

    def test_get_validations(self):
        """Test get validations endpoint"""
        success, response = self.run_test(
            "Get Validations",
            "GET",
            "validations",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Returned list with {len(response)} validations")
            return True, response
        elif success and isinstance(response, dict):
            print(f"   ⚠️  Returned dict instead of list: {response}")
            return True, response
        return False, {}

def main():
    print("🚀 Starting TrustLayer API Tests")
    print("=" * 50)
    
    tester = TrustLayerAPITester()
    
    # Test 1: Health Check
    tester.test_health_check()
    
    # Test 2: CSV Upload
    csv_success, csv_data = tester.test_csv_upload()
    
    # Test 3: CSV Text Parsing
    tester.test_csv_text_parsing()
    
    # Test 4: Excel Upload (simulated)
    tester.test_excel_upload()
    
    # Test 5: Invalid CSV
    tester.test_invalid_csv()
    
    # Test 6: Empty File
    tester.test_empty_file_upload()
    
    # Test 7: Get Validations
    tester.test_get_validations()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())