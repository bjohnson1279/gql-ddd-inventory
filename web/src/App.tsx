import { useState } from 'react'

interface Item {
  id: string;
  variantId: string;
  quantity: number;
  unitCostCents: number;
}

function App() {
  const [tenantId, setTenantId] = useState('tenant-1')
  const [locationId, setLocationId] = useState('loc-1')
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
  const [actorId, setActorId] = useState('admin-user')
  const [items, setItems] = useState<Item[]>([
    { id: Math.random().toString(36), variantId: '', quantity: 0, unitCostCents: 0 }
  ])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(36), variantId: '', quantity: 0, unitCostCents: 0 }])
  }

  const updateItem = (id: string, field: keyof Item, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    const query = `
      mutation SubmitOpeningBalance($input: SubmitOpeningBalanceInput!) {
        submitOpeningBalance(input: $input)
      }
    `

    const variables = {
      input: {
        tenantId,
        locationId,
        asOfDate,
        actorId,
        items: items.map(({ variantId, quantity, unitCostCents }) => ({
          variantId,
          quantity: Number(quantity),
          unitCostCents: Number(unitCostCents)
        }))
      }
    }

    try {
      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      })

      const result = await response.json()

      if (result.errors) {
        setStatus('error')
        setMessage(result.errors[0].message)
      } else {
        setStatus('success')
        setMessage('Opening balance submitted successfully!')
        // Reset items
        setItems([{ id: Math.random().toString(36), variantId: '', quantity: 0, unitCostCents: 0 }])
      }
    } catch (err) {
      setStatus('error')
      setMessage('Failed to connect to the server.')
    }
  }

  return (
    <div className="app-container">
      <div className="card">
        <header>
          <h1>Inventory Setup</h1>
          <p>Initialize your opening balance across locations</p>
        </header>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label>Tenant ID</label>
              <input 
                value={tenantId} 
                onChange={e => setTenantId(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Location ID</label>
              <input 
                value={locationId} 
                onChange={e => setLocationId(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label>As of Date</label>
              <input 
                type="date" 
                value={asOfDate} 
                onChange={e => setAsOfDate(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Actor ID</label>
              <input 
                value={actorId} 
                onChange={e => setActorId(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="items-section">
            <label style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Inventory Items</label>
            
            {items.map((item) => (
              <div key={item.id} className="items-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Variant ID / SKU</label>
                  <input 
                    placeholder="e.g. V-101"
                    value={item.variantId} 
                    onChange={e => updateItem(item.id, 'variantId', e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Quantity</label>
                  <input 
                    type="number" 
                    value={item.quantity} 
                    onChange={e => updateItem(item.id, 'quantity', e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Unit Cost (Cents)</label>
                  <input 
                    type="number" 
                    value={item.unitCostCents} 
                    onChange={e => updateItem(item.id, 'unitCostCents', e.target.value)} 
                    required 
                  />
                </div>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={() => removeItem(item.id)}
                  style={{ height: '42px', padding: '0 1rem' }}
                >
                  &times;
                </button>
              </div>
            ))}

            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={addItem}
              style={{ marginTop: '0.5rem' }}
            >
              + Add Item
            </button>
          </div>

          <div style={{ marginTop: '2.5rem' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Processing...' : 'Submit Opening Balance'}
            </button>
          </div>
        </form>

        {status === 'success' && <div className="success-message">{message}</div>}
        {status === 'error' && <div className="error-message">{message}</div>}
      </div>
    </div>
  )
}

export default App
