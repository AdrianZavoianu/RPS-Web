"""
Report models (PDF reports are generated on-demand, minimal persistence needed).
"""
from django.db import models

# Reports are generated on-demand via ExportJob with format='pdf'
# No additional models needed for basic reporting
