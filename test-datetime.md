```jsx
import dayjs from "dayjs"
import { Input } from "antd"

export const NativeDatetime = ({ value, onChange, ...props }) => {
    return (
        <Input
            type="datetime-local"
            value={value ? value.format('YYYY-MM-DDTHH:mm') : ''}
            onChange={(e) => {
                onChange(e.target.value ? dayjs(e.target.value) : null)
            }}
            {...props}
        />
    )
}
```
