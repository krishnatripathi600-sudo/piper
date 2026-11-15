import { Link } from 'react-router-dom'
import {
  BookOpen,
  Code,
  GitBranch,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Zap,
  Database,
  BarChart2,
  Settings,
} from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

const faqs = [
  {
    question: 'What is PIPER?',
    answer: 'PIPER (Pipeline Intelligence for Pipeline Event Recognition) is a water leakage detection system for public utility networks. It uses GRU (Gated Recurrent Unit) neural networks trained on IoT sensor data to classify whether a leak exists at a given time.',
  },
  {
    question: 'What model does PIPER use?',
    answer: 'PIPER uses a GRU-based classifier (GRUHead) with 2 layers, 64 hidden units, and a 48-hour window. The model takes 9 features per timestep: Hour, DayOfWeek, Month, roll6_mean, roll24_mean, roll6_std, roll24_std, rel_to_roll24, and Delta_Volume.',
  },
  {
    question: 'How are leaks detected?',
    answer: 'The model processes 48-hour windows of sensor data and outputs a leak probability for the last timestep. A threshold (default ~0.68, optimized via cross-validation) converts this probability into a binary prediction: leak (1) or no leak (0).',
  },
  {
    question: 'What data does PIPER use?',
    answer: 'PIPER uses hourly water meter readings (cumulative volume) from CSV files. The pipeline adds calendar features, rolling statistics, and delta volumes. During training, synthetic leak segments are injected to create supervised labels.',
  },
  {
    question: 'Can I use my own data?',
    answer: 'Yes, you can send sensor windows via the /api/v1/predict endpoint. The input must match the expected feature order and window size (48 hours × 9 features). See the Live Prediction page for the exact format.',
  },
  {
    question: 'How accurate is the model?',
    answer: 'Model performance varies by dataset. Check the Model Performance page for current metrics including accuracy, precision, recall, F1 score, and confusion matrix from the cross-validated test set.',
  },
  {
    question: 'What is the threshold and how is it chosen?',
    answer: 'The decision threshold (~0.68) is chosen via 10-fold forward-chaining cross-validation on the training set, maximizing F1 score per fold, then taking the median. This prevents temporal leakage and provides a robust operating point.',
  },
  {
    question: 'Can I retrain the model?',
    answer: 'Yes, the repository includes training scripts for GRU, LSTM, MLP, Random Forest, SVM, and XGBoost. Run them via Python CLI. Hyperparameter tuning is available via Optuna.',
  },
]

const resources = [
  { title: 'Repository', description: 'Source code and documentation', icon: GitBranch, href: 'https://github.com/ApoErch/Water-Leakage-Detection' },
  { title: 'API Documentation', description: 'Interactive API docs (Swagger UI)', icon: BookOpen, href: '/docs' },
  { title: 'Model Training Scripts', description: 'Python CLI for all algorithms', icon: Code, href: '#' },
  { title: 'SageMaker Deployment', description: 'Deploy to AWS SageMaker', icon: ExternalLink, href: '#' },
  { title: 'Report Issues', description: 'Bug reports and feature requests', icon: Mail, href: '#' },
]

export function Help() {
  const [searchQuery, setSearchQuery] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const filteredFaqs = faqs.filter((faq) =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Help & Documentation</h1>
          <p className="text-secondary-500 mt-1">Get started with PIPER leak detection system</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Link to="/" className="block">
          <Card className="h-full transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary-50 text-primary-600">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-secondary-900">Live Prediction</h3>
                  <p className="text-sm text-secondary-500">Test the model with sensor data</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/performance" className="block">
          <Card className="h-full transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-success-50 text-success-600">
                  <BarChart2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-secondary-900">Model Performance</h3>
                  <p className="text-sm text-secondary-500">View metrics and confusion matrix</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/data" className="block">
          <Card className="h-full transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-warning-50 text-warning-600">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-secondary-900">Data Explorer</h3>
                  <p className="text-sm text-secondary-500">Browse meters and test windows</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/settings" className="block">
          <Card className="h-full transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-secondary-100 text-secondary-600">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-secondary-900">Settings</h3>
                  <p className="text-sm text-secondary-500">Configure system preferences</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-secondary-900">Frequently Asked Questions</h2>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
              <Input
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredFaqs.map((faq, index) => (
              <div
                key={index}
                className="border border-secondary-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-secondary-50 transition-colors"
                >
                  <span className="font-medium text-secondary-900">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="h-5 w-5 text-secondary-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-secondary-500" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4 border-t border-secondary-100 bg-secondary-50">
                    <p className="text-secondary-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
            {filteredFaqs.length === 0 && (
              <div className="text-center py-8 text-secondary-500">
                No matching FAQs found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-secondary-900">Resources</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              resource.href.startsWith('http') ? (
                <a
                  key={resource.title}
                  href={resource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-secondary-100 text-secondary-600">
                      <resource.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-secondary-900 truncate">{resource.title}</h3>
                      <p className="text-sm text-secondary-500 mt-1">{resource.description}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-secondary-400 mt-1 flex-shrink-0" />
                  </div>
                </a>
              ) : (
                <Link
                  key={resource.title}
                  to={resource.href}
                  className="block p-4 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-secondary-100 text-secondary-600">
                      <resource.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-secondary-900 truncate">{resource.title}</h3>
                      <p className="text-sm text-secondary-500 mt-1">{resource.description}</p>
                    </div>
                  </div>
                </Link>
              )
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-secondary-900">Quick Reference</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg bg-secondary-50">
              <h3 className="font-medium text-secondary-900 mb-2">Model Input</h3>
              <div className="space-y-1 text-sm font-mono text-secondary-600">
                <div>Shape: [B, 48, 9]</div>
                <div>B = batch size</div>
                <div>48 = window (hours)</div>
                <div>9 = features</div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-secondary-50">
              <h3 className="font-medium text-secondary-900 mb-2">Features</h3>
              <div className="space-y-1 text-sm font-mono text-secondary-600">
                <div>Hour</div>
                <div>DayOfWeek</div>
                <div>Month</div>
                <div>roll6_mean</div>
                <div>roll24_mean</div>
                <div>roll6_std</div>
                <div>roll24_std</div>
                <div>rel_to_roll24</div>
                <div>Delta_Volume</div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-secondary-50">
              <h3 className="font-medium text-secondary-900 mb-2">Model Config</h3>
              <div className="space-y-1 text-sm text-secondary-600">
                <div>GRUHead (2 layers)</div>
                <div>64 hidden units</div>
                <div>Unidirectional</div>
                <div>Dropout: 0.2</div>
                <div>Threshold: ~0.68</div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-secondary-50">
              <h3 className="font-medium text-secondary-900 mb-2">API Endpoints</h3>
              <div className="space-y-1 text-sm font-mono text-secondary-600">
                <div>POST /api/v1/predict</div>
                <div>POST /api/v1/predict/batch</div>
                <div>GET /api/v1/model/info</div>
                <div>GET /api/v1/health</div>
                <div>GET /api/v1/meters</div>
                <div>GET /api/v1/data/sample</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}