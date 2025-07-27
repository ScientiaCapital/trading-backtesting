#!/usr/bin/env python3
"""
Test script to verify AI integration with Google Gemini and Anthropic Claude
"""

import os
from dotenv import load_dotenv
import google.generativeai as genai
from anthropic import Anthropic

# Load environment variables
load_dotenv()

def test_gemini_connection():
    """Test Google Gemini API connection"""
    api_key = os.getenv('GOOGLE_API_KEY')
    
    if not api_key:
        print("❌ GOOGLE_API_KEY not found in .env file")
        return False
    
    try:
        # Configure Gemini
        genai.configure(api_key=api_key)
        
        # Create the model
        model = genai.GenerativeModel('gemini-pro')
        
        # Test with a simple prompt
        response = model.generate_content("What is algorithmic trading in one sentence?")
        
        print("✅ Google Gemini API connection successful!")
        print(f"Response: {response.text}")
        return True
        
    except Exception as e:
        print(f"❌ Error connecting to Gemini API: {str(e)}")
        return False

def test_alpaca_credentials():
    """Check if Alpaca credentials are configured"""
    api_key = os.getenv('ALPACA_API_KEY_ID')
    base_url = os.getenv('ALPACA_BASE_URL')
    
    print("\n📊 Alpaca Configuration:")
    print(f"API Key ID: {'✅ Set' if api_key else '❌ Missing'}")
    print(f"Base URL: {base_url if base_url else '❌ Missing'}")
    print(f"Note: You still need to add your ALPACA_API_SECRET to the .env file")
    
    return bool(api_key and base_url)

def test_anthropic_connection():
    """Test Anthropic Claude API connection"""
    api_key = os.getenv('ANTHROPIC_API_KEY')
    
    if not api_key:
        print("❌ ANTHROPIC_API_KEY not found in .env file")
        return False
    
    try:
        # Create Anthropic client
        client = Anthropic(api_key=api_key)
        
        # Test with a simple prompt
        response = client.messages.create(
            model="claude-3-opus-20240229",
            max_tokens=100,
            messages=[{
                "role": "user",
                "content": "What is quantitative trading in one sentence?"
            }]
        )
        
        print("\n✅ Anthropic Claude API connection successful!")
        print(f"Response: {response.content[0].text}")
        return True
        
    except Exception as e:
        print(f"❌ Error connecting to Anthropic API: {str(e)}")
        return False

if __name__ == "__main__":
    print("🧪 Testing AI Integration...\n")
    
    # Test Gemini
    gemini_ok = test_gemini_connection()
    
    # Test Anthropic
    anthropic_ok = test_anthropic_connection()
    
    # Check Alpaca
    alpaca_ok = test_alpaca_credentials()
    
    print("\n" + "="*50)
    if gemini_ok and anthropic_ok:
        print("✅ All AI Integrations are working!")
    else:
        print("❌ Please check your API keys")